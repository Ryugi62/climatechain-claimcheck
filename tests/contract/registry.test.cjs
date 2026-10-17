const { expect } = require('chai');
const { ethers } = require('hardhat');

const key = (s) => ethers.id(s);
const K1 = key('GOLD_STANDARD:GS7643:2025:31135');
const K2 = key('GOLD_STANDARD:GS7643:2025:99999');
const claimA = key('claim:A');
const claimB = key('claim:B');
const ev = key('evidence:gs-api-record-610065');

async function deploy() {
  const [owner, attestor, other, attestor2] = await ethers.getSigners();
  const F = await ethers.getContractFactory('RetirementRegistry');
  const reg = await F.deploy();
  await reg.waitForDeployment();
  await reg.connect(owner).addAttestor(attestor.address);
  return { reg, owner, attestor, other, attestor2 };
}

describe('RetirementRegistry', () => {
  describe('roles', () => {
    it('deployer is the owner', async () => {
      const { reg, owner } = await deploy();
      expect(await reg.owner()).to.equal(owner.address);
    });
    it('owner can add an attestor', async () => {
      const { reg, attestor } = await deploy();
      expect(await reg.isAttestor(attestor.address)).to.equal(true);
    });
    it('non-owner cannot add an attestor', async () => {
      const { reg, other } = await deploy();
      await expect(reg.connect(other).addAttestor(other.address)).to.be.revertedWithCustomError(reg, 'NotOwner');
    });
    it('zero address cannot become attestor', async () => {
      const { reg, owner } = await deploy();
      await expect(reg.connect(owner).addAttestor(ethers.ZeroAddress)).to.be.revertedWithCustomError(reg, 'ZeroAddress');
    });
    it('owner can remove an attestor and it can no longer register', async () => {
      const { reg, owner, attestor } = await deploy();
      await reg.connect(owner).removeAttestor(attestor.address);
      await expect(reg.connect(attestor).register(K1, 1, 10, claimA, ev)).to.be.revertedWithCustomError(reg, 'NotAttestor');
    });
    it('ownership can be transferred', async () => {
      const { reg, owner, other } = await deploy();
      await reg.connect(owner).transferOwnership(other.address);
      expect(await reg.owner()).to.equal(other.address);
      await expect(reg.connect(owner).addAttestor(owner.address)).to.be.revertedWithCustomError(reg, 'NotOwner');
    });
  });

  describe('register (G8 authority)', () => {
    it('non-attestor cannot register', async () => {
      const { reg, other } = await deploy();
      await expect(reg.connect(other).register(K1, 1, 10, claimA, ev)).to.be.revertedWithCustomError(reg, 'NotAttestor');
    });
    it('attestor can register a range', async () => {
      const { reg, attestor } = await deploy();
      await expect(reg.connect(attestor).register(K1, 1059, 34189, claimA, ev)).to.emit(reg, 'Registered').withArgs(K1, 1059, 34189, claimA, ev, attestor.address);
    });
    it('stores range, claim hash and evidence hash', async () => {
      const { reg, attestor } = await deploy();
      await reg.connect(attestor).register(K1, 5, 9, claimA, ev);
      const r = await reg.rangeAt(K1, 0);
      expect(r.start).to.equal(5n);
      expect(r.end).to.equal(9n);
      expect(r.claimHash).to.equal(claimA);
      expect(r.evidenceHash).to.equal(ev);
      expect(r.attestor).to.equal(attestor.address);
    });
    it('counts ranges and credits per batch', async () => {
      const { reg, attestor } = await deploy();
      await reg.connect(attestor).register(K1, 1, 10, claimA, ev);
      await reg.connect(attestor).register(K1, 11, 15, claimB, ev);
      expect(await reg.rangeCount(K1)).to.equal(2n);
      expect(await reg.totalRegistered(K1)).to.equal(15n);
      expect(await reg.rangeCount(K2)).to.equal(0n);
    });
  });

  describe('G7 double use is refused', () => {
    async function withRange() {
      const c = await deploy();
      await c.reg.connect(c.attestor).register(K1, 100, 200, claimA, ev);
      return c;
    }
    it('exact repeat reverts RangeOverlap', async () => {
      const { reg, attestor } = await withRange();
      await expect(reg.connect(attestor).register(K1, 100, 200, claimB, ev)).to.be.revertedWithCustomError(reg, 'RangeOverlap');
    });
    it('same claim hash twice also reverts (no silent idempotence)', async () => {
      const { reg, attestor } = await withRange();
      await expect(reg.connect(attestor).register(K1, 100, 200, claimA, ev)).to.be.revertedWithCustomError(reg, 'RangeOverlap');
    });
    it('overlap on the left edge reverts', async () => {
      const { reg, attestor } = await withRange();
      await expect(reg.connect(attestor).register(K1, 50, 100, claimB, ev)).to.be.revertedWithCustomError(reg, 'RangeOverlap');
    });
    it('overlap on the right edge reverts', async () => {
      const { reg, attestor } = await withRange();
      await expect(reg.connect(attestor).register(K1, 200, 300, claimB, ev)).to.be.revertedWithCustomError(reg, 'RangeOverlap');
    });
    it('contained range reverts', async () => {
      const { reg, attestor } = await withRange();
      await expect(reg.connect(attestor).register(K1, 120, 130, claimB, ev)).to.be.revertedWithCustomError(reg, 'RangeOverlap');
    });
    it('containing range reverts', async () => {
      const { reg, attestor } = await withRange();
      await expect(reg.connect(attestor).register(K1, 1, 1000, claimB, ev)).to.be.revertedWithCustomError(reg, 'RangeOverlap');
    });
    it('single-credit overlap reverts', async () => {
      const { reg, attestor } = await withRange();
      await expect(reg.connect(attestor).register(K1, 200, 200, claimB, ev)).to.be.revertedWithCustomError(reg, 'RangeOverlap');
    });
    it('adjacent range after succeeds', async () => {
      const { reg, attestor } = await withRange();
      await reg.connect(attestor).register(K1, 201, 300, claimB, ev);
      expect(await reg.rangeCount(K1)).to.equal(2n);
    });
    it('adjacent range before succeeds', async () => {
      const { reg, attestor } = await withRange();
      await reg.connect(attestor).register(K1, 1, 99, claimB, ev);
      expect(await reg.rangeCount(K1)).to.equal(2n);
    });
    it('same numbers in another batch succeed', async () => {
      const { reg, attestor } = await withRange();
      await reg.connect(attestor).register(K2, 100, 200, claimB, ev);
      expect(await reg.rangeCount(K2)).to.equal(1n);
    });
    it('a second attestor cannot re-register an existing range either', async () => {
      const { reg, owner, attestor2 } = await withRange();
      await reg.connect(owner).addAttestor(attestor2.address);
      await expect(reg.connect(attestor2).register(K1, 150, 160, claimB, ev)).to.be.revertedWithCustomError(reg, 'RangeOverlap');
    });
    it('the revert names the existing range', async () => {
      const { reg, attestor } = await withRange();
      await expect(reg.connect(attestor).register(K1, 150, 250, claimB, ev)).to.be.revertedWithCustomError(reg, 'RangeOverlap').withArgs(K1, 100, 200);
    });
    it('a failed registration leaves state unchanged', async () => {
      const { reg, attestor } = await withRange();
      await reg.connect(attestor).register(K1, 100, 200, claimB, ev).catch(() => {});
      expect(await reg.rangeCount(K1)).to.equal(1n);
      expect(await reg.totalRegistered(K1)).to.equal(101n);
    });
  });

  describe('input checks', () => {
    it('start after end reverts InvalidRange', async () => {
      const { reg, attestor } = await deploy();
      await expect(reg.connect(attestor).register(K1, 10, 9, claimA, ev)).to.be.revertedWithCustomError(reg, 'InvalidRange');
    });
    it('start of zero reverts InvalidRange (serial numbers start at 1)', async () => {
      const { reg, attestor } = await deploy();
      await expect(reg.connect(attestor).register(K1, 0, 9, claimA, ev)).to.be.revertedWithCustomError(reg, 'InvalidRange');
    });
    it('single-credit range is valid', async () => {
      const { reg, attestor } = await deploy();
      await reg.connect(attestor).register(K1, 7, 7, claimA, ev);
      expect(await reg.totalRegistered(K1)).to.equal(1n);
    });
  });

  describe('views and cost', () => {
    it('conflictsWith reports overlap without a transaction', async () => {
      const { reg, attestor } = await deploy();
      await reg.connect(attestor).register(K1, 100, 200, claimA, ev);
      expect(await reg.conflictsWith(K1, 150, 160)).to.equal(true);
      expect(await reg.conflictsWith(K1, 201, 210)).to.equal(false);
      expect(await reg.conflictsWith(K2, 150, 160)).to.equal(false);
    });
    it('writing 40 disjoint ranges then probing every gap stays consistent', async () => {
      const { reg, attestor } = await deploy();
      for (let i = 0; i < 40; i++) await reg.connect(attestor).register(K1, i * 10 + 1, i * 10 + 9, claimA, ev);
      for (let i = 0; i < 40; i++) {
        expect(await reg.conflictsWith(K1, i * 10 + 10, i * 10 + 10)).to.equal(false);
        expect(await reg.conflictsWith(K1, i * 10 + 5, i * 10 + 5)).to.equal(true);
      }
      expect(await reg.totalRegistered(K1)).to.equal(360n);
    });
    it('gas of one registration stays under 200k (first) and 400k (40th)', async () => {
      const { reg, attestor } = await deploy();
      const first = await (await reg.connect(attestor).register(K1, 1, 9, claimA, ev)).wait();
      for (let i = 1; i < 39; i++) await reg.connect(attestor).register(K1, i * 10 + 1, i * 10 + 9, claimA, ev);
      const fortieth = await (await reg.connect(attestor).register(K1, 391, 399, claimA, ev)).wait();
      console.log(`      gas first=${first.gasUsed} fortieth=${fortieth.gasUsed}`);
      expect(first.gasUsed < 200000n).to.equal(true);
      expect(fortieth.gasUsed < 400000n).to.equal(true);
    });
    it('a refused duplicate reverts before any state write (estimateGas fails)', async () => {
      const { reg, attestor } = await deploy();
      const ok = await (await reg.connect(attestor).register(K1, 1, 9, claimA, ev)).wait();
      const gas = await reg.connect(attestor).register.estimateGas(K1, 1, 9, claimB, ev).catch(() => null);
      expect(gas).to.equal(null); // estimateGas itself reverts: the chain refuses before any state write
      expect(ok.gasUsed > 0n).to.equal(true);
    });
  });
});
