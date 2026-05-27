import {
  ESCROW_ADDRESS,
  escrowAbi,
  depositToEscrow,
  getEscrowBalance,
} from "@/lib/web3/contracts";

describe("ESCROW_ADDRESS", () => {
  it("is the correct zero address", () => {
    expect(ESCROW_ADDRESS).toBe(
      "0x0000000000000000000000000000000000000000"
    );
  });

  it("starts with 0x prefix", () => {
    expect(ESCROW_ADDRESS).toMatch(/^0x/);
  });

  it("is exactly 42 characters long", () => {
    expect(ESCROW_ADDRESS.length).toBe(42);
  });

  it("contains only hex characters after 0x", () => {
    expect(ESCROW_ADDRESS.slice(2)).toMatch(/^[0-9a-fA-F]+$/);
  });
});

describe("escrowAbi", () => {
  it("is an array", () => {
    expect(Array.isArray(escrowAbi)).toBe(true);
  });

  it("has 7 entries", () => {
    expect(escrowAbi.length).toBe(7);
  });

  it("contains Deposit event", () => {
    const deposit = escrowAbi.find(
      (item) => item.type === "event" && item.name === "Deposit"
    );
    expect(deposit).toBeDefined();
    expect(deposit?.inputs).toEqual([]);
  });

  it("contains Withdraw event", () => {
    const withdraw = escrowAbi.find(
      (item) => item.type === "event" && item.name === "Withdraw"
    );
    expect(withdraw).toBeDefined();
    expect(withdraw?.inputs).toEqual([]);
  });

  it("contains Lock event", () => {
    const lock = escrowAbi.find(
      (item) => item.type === "event" && item.name === "Lock"
    );
    expect(lock).toBeDefined();
    expect(lock?.inputs).toEqual([]);
  });

  it("contains Unlock event", () => {
    const unlock = escrowAbi.find(
      (item) => item.type === "event" && item.name === "Unlock"
    );
    expect(unlock).toBeDefined();
    expect(unlock?.inputs).toEqual([]);
  });

  it("contains deposit function", () => {
    const deposit = escrowAbi.find(
      (item) => item.type === "function" && item.name === "deposit"
    );
    expect(deposit).toBeDefined();
    expect(deposit?.stateMutability).toBe("payable");
    expect(deposit?.inputs).toEqual([
      { name: "provider", type: "address" },
      { name: "amount", type: "uint256" },
    ]);
    expect(deposit?.outputs).toEqual([]);
  });

  it("contains getEscrowStats function", () => {
    const stats = escrowAbi.find(
      (item) => item.type === "function" && item.name === "getEscrowStats"
    );
    expect(stats).toBeDefined();
    expect(stats?.stateMutability).toBe("view");
    expect(stats?.inputs).toEqual([{ name: "provider", type: "address" }]);
    expect(stats?.outputs).toEqual([
      { name: "", type: "uint256" },
      { name: "", type: "uint256" },
      { name: "", type: "uint256" },
    ]);
  });
});

describe("depositToEscrow", () => {
  it("returns expected shape with zero hash", async () => {
    const provider = "0x1234567890123456789012345678901234567890";
    const amount = 1000n;
    const result = await depositToEscrow(provider, amount);

    expect(result).toHaveProperty("hash");
    expect(result).toHaveProperty("provider");
    expect(result).toHaveProperty("amount");
    expect(result.hash).toBe(
      "0x0000000000000000000000000000000000000000000000000000000000000000"
    );
    expect(result.provider).toBe(provider);
    expect(result.amount).toBe(amount);
  });

  it("works with different providers", async () => {
    const provider = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
    const amount = 500n;
    const result = await depositToEscrow(provider, amount);
    expect(result.provider).toBe(provider);
    expect(result.amount).toBe(amount);
  });

  it("works with zero amount", async () => {
    const provider = "0x1234567890123456789012345678901234567890";
    const result = await depositToEscrow(provider, 0n);
    expect(result.amount).toBe(0n);
  });
});

describe("getEscrowBalance", () => {
  it("returns 0n", async () => {
    const provider = "0x1234567890123456789012345678901234567890";
    const result = await getEscrowBalance(provider);
    expect(result).toBe(0n);
    expect(typeof result).toBe("bigint");
  });

  it("returns same value for any provider", async () => {
    const provider1 = "0x1234567890123456789012345678901234567890";
    const provider2 = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
    const result1 = await getEscrowBalance(provider1);
    const result2 = await getEscrowBalance(provider2);
    expect(result1).toBe(0n);
    expect(result2).toBe(0n);
    expect(result1).toBe(result2);
  });
});
