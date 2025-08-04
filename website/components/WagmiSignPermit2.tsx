'use client'

import {
  parseAbi,
  maxUint256,
  getAddress,
  parseEther,
  isAddress,
  formatEther,
  stringify,
} from "viem";
import { useAccount, useSignTypedData, useConfig } from "wagmi";
import {
  readContract,
  waitForTransactionReceipt,
  writeContract,
} from "@wagmi/core";

import { useEffect, useState } from "react";

const erc20ABI = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) public view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
]);

const tokenBankABI = parseAbi([
  "struct TokenPermissions { address token; uint256 amount; }",
  "struct PermitTransferFrom {TokenPermissions permitted; uint256 nonce; uint256 deadline; }",
  "function depositWithPermit2(address token,uint256 amount,PermitTransferFrom permit,bytes signature)",
]);
const workChainId = 80002n;
const domain = {
  name: "Permit2",
  chainId: 80002n,
  verifyingContract: "0x000000000022D473030F116dDEE9F6B43aC78BA3", // permit2
} as const;

const types = {
  EIP712Domain: [
    { name: "name", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" },
  ],
  TokenPermissions: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
  ],
  PermitTransferFrom: [
    { name: "permitted", type: "TokenPermissions" },
    { name: "spender", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export default function WagmiSignPermit2() {

  const tokenBank = getAddress("0xf04DA1FfDA455F24cD217fbb2dFE2A079e15e02b");
  const loginAccount = useAccount();
  const config = useConfig();

  const [msg, setMsg] = useState<string | null>(null);
  const [token, setToken] = useState<string>("");
  const [amount, setAmount] = useState(0n);
  const [isPending, setIsPending] = useState(false);

  const [tokenAllowance, setTokenAllowance] = useState<bigint | null>(null);

  useEffect(() => {
    if (isAddress(token)) {
    
      readContract(config, {
        address: token,
        abi: erc20ABI,
        functionName: "allowance",
        args: [loginAccount.address!, domain.verifyingContract],
      }).then((result) => {
        console.log(result)
        setTokenAllowance(result);
      });
    }
  }, [token]);

  const { signTypedDataAsync } = useSignTypedData();
  const chainId = loginAccount && loginAccount.chainId;
  const canDeposit =
    chainId !== undefined &&
    BigInt(chainId) === workChainId &&
    !isPending &&
    token !== null &&
    isAddress(token) &&
    amount > 0n;

  const handleDeposit = async () => {
    if (isPending) return;

    try {
      setIsPending(true);
      setMsg(null);
      if (token == null) return;
      if (!isAddress(token)) return;
      if (tokenAllowance == null) return;

      // 1. check allowance
      if (tokenAllowance <= amount) {
        printLog("Please approve first");
        // send approve transaction
        const hash = await writeContract(config, {
          address: token!,
          abi: erc20ABI,
          functionName: "approve",
          args: [domain.verifyingContract, maxUint256],
        });
        console.log("approve hash", hash);
        const receipt = await waitForTransactionReceipt(config, { hash });
        console.log("approve receipt", receipt);
        // wait for approve transaction
        setTokenAllowance(maxUint256);
        printLog(`Approve success: ${hash}`);
      }
      // 2. sign permit
      const permit = {
        permitted: {
          token: token!,
          amount: BigInt(amount),
        },
        spender: tokenBank,
        nonce: BigInt(Math.ceil(new Date().getTime())),
        deadline: BigInt(Math.ceil(new Date().getTime() / 1000 + 3600)),
      };

      printLog(`Please sign permit`);
      const signature = await signTypedDataAsync({
        types: types,
        primaryType: "PermitTransferFrom",
        message: permit,
        domain: domain,
      });
      printLog(`Permit signature: ${signature}`);
      printLog("Please wait for deposit transaction");
      // 3. depositWithPermit2
      const hash = await writeContract(config, {
        address: tokenBank,
        abi: tokenBankABI,
        functionName: "depositWithPermit2",
        args: [token, amount, permit, signature],
      });
      console.log(hash);
      const receipt = await waitForTransactionReceipt(config, { hash });
      console.log("receipt", receipt);
      printLog(`Success: ${hash}`);
    } catch (error: any) {
      console.error(error);
      if (error && error.shortMessage) {
        printLog(`Error: ${error.shortMessage}`);
      } else {
        printLog(`Error: ${stringify(error)}`);
      }
    } finally {
      setIsPending(false);
    }
  };

  const printLog = (str: string) => {
    if (msg == null) {
      setMsg(str); // first line
    } else {
      setMsg(msg + "\n" + str);
    }
  };

  return (
    <>
      <h2>Token Bank Permit2</h2>
      <span>Welcome {loginAccount.address}</span>
      <br />
      {chainId !== undefined && BigInt(chainId) !== workChainId && (
        <span>Please change to {workChainId.toString()}</span>
      )}
      <span>
        allowance amount:
        {formatEther(tokenAllowance ? tokenAllowance : 0n)}{" "}
      </span>
      <input
        type="text"
        value={token}
        onChange={(e) => setToken(e.target.value)}
      />
      <br />
      <input
        type="number"
        value={formatEther(amount)}
        onChange={(e) => setAmount(parseEther(e.target.value))}
      />
      <button onClick={handleDeposit} disabled={canDeposit == false}>
        Deposit Token
      </button>
      {msg && (
        <div style={{ border: "1px solid blue" }}>
          <span>{msg}</span>
        </div>
      )}
    </>
  );
}