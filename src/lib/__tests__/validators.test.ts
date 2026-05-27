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
    encrypted_api_key: "encrypted-key-123",
  };

  it("passes with valid input", () => {
    expect(() => providerRegistrationSchema.parse(validInput)).not.toThrow();
    const result = providerRegistrationSchema.parse(validInput);
    expect(result).toEqual(validInput);
  });

  it("passes with optional delegation_json", () => {
    const input = { ...validInput, delegation_json: { role: "admin" } };
    const result = providerRegistrationSchema.parse(input);
    expect(result.delegation_json).toEqual({ role: "admin" });
  });

  it("fails when wallet_address is missing", () => {
    const { wallet_address: _wallet, ...rest } = validInput;
    void _wallet;
    expect(() => providerRegistrationSchema.parse(rest)).toThrow();
  });

  it("fails with wallet address too short", () => {
    expect(() =>
      providerRegistrationSchema.parse({
        ...validInput,
        wallet_address: "0x123",
      })
    ).toThrow("Invalid wallet address format. Must be 0x followed by 40 hex characters.");
  });

  it("fails with wallet address missing 0x prefix", () => {
    expect(() =>
      providerRegistrationSchema.parse({
        ...validInput,
        wallet_address: "1234567890123456789012345678901234567890",
      })
    ).toThrow("Invalid wallet address format. Must be 0x followed by 40 hex characters.");
  });

  it("fails with wallet address containing non-hex characters", () => {
    expect(() =>
      providerRegistrationSchema.parse({
        ...validInput,
        wallet_address: "0xG234567890123456789012345678901234567890",
      })
    ).toThrow("Invalid wallet address format. Must be 0x followed by 40 hex characters.");
  });

  it("fails with wallet address longer than 42 chars", () => {
    expect(() =>
      providerRegistrationSchema.parse({
        ...validInput,
        wallet_address: "0x12345678901234567890123456789012345678901",
      })
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

  it("fails when encrypted_api_key is missing", () => {
    const { encrypted_api_key: _key, ...rest } = validInput;
    void _key;
    expect(() => providerRegistrationSchema.parse(rest)).toThrow();
  });

  it("fails with empty encrypted_api_key", () => {
    expect(() =>
      providerRegistrationSchema.parse({ ...validInput, encrypted_api_key: "" })
    ).toThrow("Encrypted API key is required.");
  });
});

describe("listingSchema", () => {
  const validInput = {
    provider_id: "550e8400-e29b-41d4-a716-446655440000",
    name: "GPT-4 Service",
    description: "A powerful language model API service.",
    model_type: "chat",
    price_per_request: 100n,
    endpoint_url: "https://api.example.com/v1/chat",
  };

  it("passes with valid input", () => {
    expect(() => listingSchema.parse(validInput)).not.toThrow();
    const result = listingSchema.parse(validInput);
    expect(result).toEqual(validInput);
  });

  it("passes with all valid model types", () => {
    const modelTypes = [
      "chat",
      "completion",
      "embedding",
      "image",
      "audio",
      "video",
      "other",
    ] as const;
    for (const modelType of modelTypes) {
      const result = listingSchema.parse({
        ...validInput,
        model_type: modelType,
      });
      expect(result.model_type).toBe(modelType);
    }
  });

  it("fails with invalid model type", () => {
    expect(() =>
      listingSchema.parse({ ...validInput, model_type: "invalid" })
    ).toThrow();
  });

  it("fails with invalid provider_id (not UUID v4)", () => {
    expect(() =>
      listingSchema.parse({ ...validInput, provider_id: "not-a-uuid" })
    ).toThrow("Invalid provider ID format.");
  });

  it("fails with UUID v1 instead of v4", () => {
    expect(() =>
      listingSchema.parse({
        ...validInput,
        provider_id: "550e8400-e29b-11d4-a716-446655440000",
      })
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

  it("fails with non-positive bigint price_per_request", () => {
    expect(() =>
      listingSchema.parse({ ...validInput, price_per_request: 0n })
    ).toThrow("Price must be a positive number.");
  });

  it("fails with negative bigint price_per_request", () => {
    expect(() =>
      listingSchema.parse({ ...validInput, price_per_request: -1n })
    ).toThrow("Price must be a positive number.");
  });

  it("fails with invalid endpoint_url", () => {
    expect(() =>
      listingSchema.parse({ ...validInput, endpoint_url: "not-a-url" })
    ).toThrow("Invalid endpoint URL format.");
  });

  it("fails when endpoint_url is missing", () => {
    const { endpoint_url: _url, ...rest } = validInput;
    void _url;
    expect(() => listingSchema.parse(rest)).toThrow();
  });
});

describe("consumerPermissionSchema", () => {
  const validInput = {
    consumer_id: "550e8400-e29b-41d4-a716-446655440000",
    listing_id: "6ba7b810-9dad-41d1-a0b4-00c04fd430c8",
    session_key: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
  };

  it("passes with valid input", () => {
    expect(() => consumerPermissionSchema.parse(validInput)).not.toThrow();
    const result = consumerPermissionSchema.parse(validInput);
    expect(result).toEqual(validInput);
  });

  it("passes with optional permissions_json", () => {
    const input = {
      ...validInput,
      permissions_json: { read: true, write: false },
    };
    const result = consumerPermissionSchema.parse(input);
    expect(result.permissions_json).toEqual({ read: true, write: false });
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

  it("fails with invalid session_key format (missing 0x)", () => {
    expect(() =>
      consumerPermissionSchema.parse({
        ...validInput,
        session_key: "abcdefabcdefabcdefabcdefabcdefabcdefabcd",
      })
    ).toThrow(
      "Invalid session key format. Must be 0x followed by 40 hex characters."
    );
  });

  it("fails with session_key too short", () => {
    expect(() =>
      consumerPermissionSchema.parse({
        ...validInput,
        session_key: "0xabc123",
      })
    ).toThrow(
      "Invalid session key format. Must be 0x followed by 40 hex characters."
    );
  });
});

describe("transactionSchema", () => {
  const validInput = {
    listing_id: "550e8400-e29b-41d4-a716-446655440000",
    consumer_id: "6ba7b810-9dad-41d1-a0b4-00c04fd430c8",
    tx_hash: "0xabc123def456",
    amount: 500n,
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

  it("fails with empty tx_hash", () => {
    expect(() =>
      transactionSchema.parse({ ...validInput, tx_hash: "" })
    ).toThrow("Transaction hash is required.");
  });

  it("fails with zero amount", () => {
    expect(() =>
      transactionSchema.parse({ ...validInput, amount: 0n })
    ).toThrow("Amount must be a positive number.");
  });

  it("fails with negative amount", () => {
    expect(() =>
      transactionSchema.parse({ ...validInput, amount: -100n })
    ).toThrow("Amount must be a positive number.");
  });
});

describe("claimSchema", () => {
  const validInput = {
    provider_id: "550e8400-e29b-41d4-a716-446655440000",
    amount: 1000n,
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

  it("fails with zero amount", () => {
    expect(() =>
      claimSchema.parse({ ...validInput, amount: 0n })
    ).toThrow("Amount must be a positive number.");
  });

  it("fails with negative amount", () => {
    expect(() =>
      claimSchema.parse({ ...validInput, amount: -1n })
    ).toThrow("Amount must be a positive number.");
  });

  it("fails with empty tx_hash", () => {
    expect(() =>
      claimSchema.parse({ ...validInput, tx_hash: "" })
    ).toThrow("Transaction hash is required.");
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

  it("passes with negative amount (no positive constraint)", () => {
    const result = x402PaymentSchema.parse({ ...validInput, amount: -50n });
    expect(result.amount).toBe(-50n);
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
