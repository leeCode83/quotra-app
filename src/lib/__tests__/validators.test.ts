import {
  providerRegistrationSchema,
  listingSchema,
  consumerPermissionSchema,
  transactionSchema,
  claimSchema,
  x402PaymentSchema,
} from "@/lib/validators";

describe("providerRegistrationSchema", () => {
  const validInput = {
    wallet_address: "0x1234567890123456789012345678901234567890",
    name: "Test Provider",
  };

  it("passes with valid input", () => {
    expect(() => providerRegistrationSchema.parse(validInput)).not.toThrow();
    const result = providerRegistrationSchema.parse(validInput);
    expect(result).toEqual(validInput);
  });

  it("fails when wallet_address is missing", () => {
    const { wallet_address: _wallet, ...rest } = validInput;
    void _wallet;
    expect(() => providerRegistrationSchema.parse(rest)).toThrow();
  });

  it("fails with wallet address too short", () => {
    expect(() =>
      providerRegistrationSchema.parse({ ...validInput, wallet_address: "0x123" })
    ).toThrow("Invalid wallet address format. Must be 0x followed by 40 hex characters.");
  });

  it("fails with name shorter than 3 characters", () => {
    expect(() =>
      providerRegistrationSchema.parse({ ...validInput, name: "ab" })
    ).toThrow("Name must be at least 3 characters long.");
  });

  it("fails when name is missing", () => {
    const { name: _name, ...rest } = validInput;
    void _name;
    expect(() => providerRegistrationSchema.parse(rest)).toThrow();
  });
});

describe("listingSchema", () => {
  const validInput = {
    provider_id: "550e8400-e29b-41d4-a716-446655440000",
    name: "GPT-4 Service",
    description: "A powerful language model API service.",
    model_name: "gpt-4",
    price_per_call_usdc: "0.0001",
    max_calls: 1000,
    max_input_chars: 2000,
    max_completion_tokens: 500,
    expires_at: "2026-12-31T23:59:59Z",
    delegation_id: "del-abc-123",
    signed_delegation: { version: "1", delegate: "0xabc" },
    encrypted_key: "aabbccdd",
    key_iv: "001122",
    key_auth_tag: "ffeedd",
  };

  it("passes with valid input", () => {
    expect(() => listingSchema.parse(validInput)).not.toThrow();
  });

  it("applies default max_input_chars and max_completion_tokens", () => {
    const { max_input_chars: _c, max_completion_tokens: _t, ...rest } = validInput;
    void _c; void _t;
    const result = listingSchema.parse(rest);
    expect(result.max_input_chars).toBe(2000);
    expect(result.max_completion_tokens).toBe(500);
  });

  it("fails with invalid provider_id (not UUID v4)", () => {
    expect(() =>
      listingSchema.parse({ ...validInput, provider_id: "not-a-uuid" })
    ).toThrow("Invalid provider ID format.");
  });

  it("fails with name shorter than 3 characters", () => {
    expect(() =>
      listingSchema.parse({ ...validInput, name: "ab" })
    ).toThrow("Name must be at least 3 characters long.");
  });

  it("fails with description shorter than 10 characters", () => {
    expect(() =>
      listingSchema.parse({ ...validInput, description: "short" })
    ).toThrow("Description must be at least 10 characters long.");
  });

  it("fails with invalid price_per_call_usdc", () => {
    expect(() =>
      listingSchema.parse({ ...validInput, price_per_call_usdc: "abc" })
    ).toThrow();
  });

  it("fails with non-positive max_calls", () => {
    expect(() =>
      listingSchema.parse({ ...validInput, max_calls: 0 })
    ).toThrow("max_calls must be a positive integer.");
  });

  it("fails with invalid expires_at", () => {
    expect(() =>
      listingSchema.parse({ ...validInput, expires_at: "not-a-date" })
    ).toThrow();
  });

  it("fails when delegation_id is missing", () => {
    const { delegation_id: _d, ...rest } = validInput;
    void _d;
    expect(() => listingSchema.parse(rest)).toThrow();
  });

  it("fails when encrypted_key is missing", () => {
    const { encrypted_key: _k, ...rest } = validInput;
    void _k;
    expect(() => listingSchema.parse(rest)).toThrow();
  });
});

describe("consumerPermissionSchema", () => {
  const validInput = {
    consumer_id: "550e8400-e29b-41d4-a716-446655440000",
    listing_id: "6ba7b810-9dad-41d1-a0b4-00c04fd430c8",
    erc7715_proof: "0xabc123def456proof",
    expires_at: "2026-12-31T23:59:59Z",
  };

  it("passes with valid input", () => {
    expect(() => consumerPermissionSchema.parse(validInput)).not.toThrow();
    const result = consumerPermissionSchema.parse(validInput);
    expect(result).toEqual(validInput);
  });

  it("fails with invalid consumer_id format", () => {
    expect(() =>
      consumerPermissionSchema.parse({ ...validInput, consumer_id: "bad-id" })
    ).toThrow("Invalid consumer ID format.");
  });

  it("fails with invalid listing_id format", () => {
    expect(() =>
      consumerPermissionSchema.parse({ ...validInput, listing_id: "bad-id" })
    ).toThrow("Invalid listing ID format.");
  });

  it("fails with empty erc7715_proof", () => {
    expect(() =>
      consumerPermissionSchema.parse({ ...validInput, erc7715_proof: "" })
    ).toThrow("ERC-7715 proof is required.");
  });
});

describe("transactionSchema", () => {
  const validInput = {
    listing_id: "550e8400-e29b-41d4-a716-446655440000",
    consumer_id: "6ba7b810-9dad-41d1-a0b4-00c04fd430c8",
    payment_tx_hash: "0xabc123def456",
    amount_usdc: "0.0001",
    provider_amount_usdc: "0.00009",
    platform_amount_usdc: "0.00001",
  };

  it("passes with valid input", () => {
    expect(() => transactionSchema.parse(validInput)).not.toThrow();
    const result = transactionSchema.parse(validInput);
    expect(result).toEqual(validInput);
  });

  it("fails with invalid listing_id", () => {
    expect(() =>
      transactionSchema.parse({ ...validInput, listing_id: "not-uuid" })
    ).toThrow("Invalid listing ID format.");
  });

  it("fails with invalid consumer_id", () => {
    expect(() =>
      transactionSchema.parse({ ...validInput, consumer_id: "not-uuid" })
    ).toThrow("Invalid consumer ID format.");
  });

  it("fails with empty payment_tx_hash", () => {
    expect(() =>
      transactionSchema.parse({ ...validInput, payment_tx_hash: "" })
    ).toThrow("Transaction hash is required.");
  });

  it("fails with invalid amount_usdc", () => {
    expect(() =>
      transactionSchema.parse({ ...validInput, amount_usdc: "abc" })
    ).toThrow();
  });
});

describe("claimSchema", () => {
  const validInput = {
    provider_id: "550e8400-e29b-41d4-a716-446655440000",
    amount_usdc: "100.00",
    tx_hash: "claim-hash-123",
  };

  it("passes with valid input", () => {
    expect(() => claimSchema.parse(validInput)).not.toThrow();
    const result = claimSchema.parse(validInput);
    expect(result).toEqual(validInput);
  });

  it("fails with invalid provider_id", () => {
    expect(() =>
      claimSchema.parse({ ...validInput, provider_id: "bad-id" })
    ).toThrow("Invalid provider ID format.");
  });

  it("fails with empty tx_hash", () => {
    expect(() =>
      claimSchema.parse({ ...validInput, tx_hash: "" })
    ).toThrow("Transaction hash is required.");
  });

  it("fails with invalid amount_usdc", () => {
    expect(() =>
      claimSchema.parse({ ...validInput, amount_usdc: "abc" })
    ).toThrow();
  });
});

describe("x402PaymentSchema", () => {
  const validInput = {
    listing_id: "550e8400-e29b-41d4-a716-446655440000",
    amount: 250n,
    tx_hash: "payment-hash-456",
    signature: "sig-abc-123",
  };

  it("passes with valid input", () => {
    expect(() => x402PaymentSchema.parse(validInput)).not.toThrow();
    const result = x402PaymentSchema.parse(validInput);
    expect(result).toEqual(validInput);
  });

  it("passes with zero amount (no positive constraint)", () => {
    const result = x402PaymentSchema.parse({ ...validInput, amount: 0n });
    expect(result.amount).toBe(0n);
  });

  it("fails with invalid listing_id", () => {
    expect(() =>
      x402PaymentSchema.parse({ ...validInput, listing_id: "bad-uuid" })
    ).toThrow("Invalid listing ID format.");
  });

  it("fails with empty tx_hash", () => {
    expect(() =>
      x402PaymentSchema.parse({ ...validInput, tx_hash: "" })
    ).toThrow("Transaction hash is required.");
  });

  it("fails with empty signature", () => {
    expect(() =>
      x402PaymentSchema.parse({ ...validInput, signature: "" })
    ).toThrow("Payment signature is required.");
  });
});
