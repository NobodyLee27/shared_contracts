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
import { useAccount, useSignTypedData, useConfig,  useConnect, useDisconnect } from "wagmi";
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
  "function balances(address user, address token) view returns (uint256)",
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
    const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const loginAccount = useAccount();
  const config = useConfig();

  const [msg, setMsg] = useState<string | null>(null);
  const [token, setToken] = useState<string>("");
  const [amount, setAmount] = useState(0n);
  const [isPending, setIsPending] = useState(false);

  const [tokenAllowance, setTokenAllowance] = useState<bigint | null>(null);
  const [tokenBalance, setTokenBalance] = useState<bigint | null>(null);
  const [bankBalance, setBankBalance] = useState<bigint | null>(null);
  const [tokenSymbol, setTokenSymbol] = useState<string>("");

  useEffect(() => {
    if (isAddress(token) && loginAccount.address) {
      // 获取用户对Permit2的授权额度
      readContract(config, {
        address: token,
        abi: erc20ABI,
        functionName: "allowance",
        args: [loginAccount.address, domain.verifyingContract],
      }).then((result) => {
        console.log("allowance:", result);
        setTokenAllowance(result);
      }).catch(console.error);

      // 获取用户的代币余额
      readContract(config, {
        address: token,
        abi: erc20ABI,
        functionName: "balanceOf",
        args: [loginAccount.address],
      }).then((result) => {
        setTokenBalance(result);
      }).catch(console.error);

      // 获取代币符号
      readContract(config, {
        address: token,
        abi: erc20ABI,
        functionName: "symbol",
        args: [],
      }).then((result) => {
        setTokenSymbol(result);
      }).catch(console.error);

      // 获取用户在TokenBank中的余额
      readContract(config, {
        address: tokenBank,
        abi: tokenBankABI,
        functionName: "balances",
        args: [loginAccount.address, token],
      }).then((result) => {
        setBankBalance(result);
      }).catch(console.error);
    }
  }, [token, loginAccount.address, config, tokenBank]);

  const { signTypedDataAsync } = useSignTypedData();
  const chainId = loginAccount && loginAccount.chainId;
  const canDeposit =
    chainId !== undefined &&
    BigInt(chainId) === workChainId &&
    !isPending &&
    token !== null &&
    isAddress(token) &&
    amount > 0n &&
    tokenBalance !== null &&
    tokenBalance >= amount;

  const handleDeposit = async () => {
    if (isPending) return;

    try {
      setIsPending(true);
      setMsg(null);
      if (token == null) return;
      if (!isAddress(token)) return;
      if (tokenAllowance == null) return;
      if (tokenBalance == null) return;

      // 检查用户余额是否足够
      if (tokenBalance < amount) {
        printLog("钱包余额不足");
        return;
      }

      // 1. 检查对Permit2的授权
      if (tokenAllowance < amount) {
        printLog("需要先授权给Permit2合约...");
        // 发送授权交易
        const hash = await writeContract(config, {
          address: token!,
          abi: erc20ABI,
          functionName: "approve",
          args: [domain.verifyingContract, maxUint256],
        });
        console.log("approve hash", hash);
        const receipt = await waitForTransactionReceipt(config, { hash });
        console.log("approve receipt", receipt);
        // 等待授权交易完成
        setTokenAllowance(maxUint256);
        printLog(`授权成功: ${hash}`);
      }

      // 2. 签署permit
      const permit = {
        permitted: {
          token: token!,
          amount: BigInt(amount),
        },
        spender: tokenBank,
        nonce: BigInt(Math.ceil(new Date().getTime())),
        deadline: BigInt(Math.ceil(new Date().getTime() / 1000 + 3600)),
      };

      printLog(`请在钱包中签署Permit授权...`);
      const signature = await signTypedDataAsync({
        types: types,
        primaryType: "PermitTransferFrom",
        message: permit,
        domain: domain,
      });
      printLog(`Permit签名完成: ${signature.slice(0, 10)}...`);
      printLog("正在执行存款交易...");
      
      // 3. 使用Permit2进行存款
      const hash = await writeContract(config, {
        address: tokenBank,
        abi: tokenBankABI,
        functionName: "depositWithPermit2",
        args: [token, amount, permit, signature],
      });
      console.log("deposit hash:", hash);
      const receipt = await waitForTransactionReceipt(config, { hash });
      console.log("deposit receipt:", receipt);
      printLog(`存款成功: ${hash}`);

      // 更新余额信息
      if (loginAccount.address) {
        // 更新用户代币余额
        const newTokenBalance = await readContract(config, {
          address: token,
          abi: erc20ABI,
          functionName: "balanceOf",
          args: [loginAccount.address],
        });
        setTokenBalance(newTokenBalance);

        // 更新银行余额
        const newBankBalance = await readContract(config, {
          address: tokenBank,
          abi: tokenBankABI,
          functionName: "balances",
          args: [loginAccount.address, token],
        });
        setBankBalance(newBankBalance);
      }
    } catch (error: any) {
      console.error(error);
      if (error && error.shortMessage) {
        printLog(`错误: ${error.shortMessage}`);
      } else {
        printLog(`错误: ${stringify(error)}`);
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
      <h2>Token Bank Permit2 存款</h2>
       {loginAccount.status === 'connected' ? (
        <div>
          <span>欢迎 {loginAccount.address}</span>
          <button 
            onClick={() => disconnect()}
            style={{ marginLeft: '10px', padding: '5px 10px' }}
          >
            断开连接
          </button>
        </div>
      ) : (
        <div>
          <span>请连接钱包</span>
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              onClick={() => connect({ connector })}
              style={{ margin: '5px', padding: '5px 10px' }}
            >
              连接 {connector.name}
            </button>
          ))}
        </div>
      )}
      
      <br />
      <div>连接状态: {loginAccount.status}</div>
      <div>链ID: {loginAccount.chainId}</div>
      <span>欢迎 {loginAccount.address}</span>
      <br />
      {chainId !== undefined && BigInt(chainId) !== workChainId && (
        <div style={{ 
          color: "red", 
          fontWeight: "bold", 
          margin: "10px 0",
          padding: "10px",
          border: "1px solid red",
          borderRadius: "5px",
          backgroundColor: "#ffe6e6"
        }}>
          ⚠️ 请切换到链 {workChainId.toString()}
        </div>
      )}
      <br />
      <div style={{ marginBottom: "15px" }}>
        <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>代币地址:</label>
        <input
          type="text"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="输入ERC20代币地址"
          style={{ 
            width: "400px", 
            padding: "8px",
            border: "1px solid #ccc",
            borderRadius: "4px",
            fontSize: "14px"
          }}
        />
        {tokenSymbol && (
          <span style={{ marginLeft: "10px", color: "#666" }}>({tokenSymbol})</span>
        )}
      </div>
      
      <div style={{ marginBottom: "15px" }}>
        <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>存入数量:</label>
        <input
          type="number"
          value={formatEther(amount)}
          onChange={(e) => setAmount(parseEther(e.target.value || "0"))}
          placeholder="输入存入数量"
          style={{ 
            padding: "8px",
            border: "1px solid #ccc",
            borderRadius: "4px",
            fontSize: "14px",
            width: "200px"
          }}
        />
      </div>
      
      <div style={{ 
        backgroundColor: "#f8f9fa", 
        padding: "15px", 
        borderRadius: "8px", 
        marginBottom: "15px",
        border: "1px solid #e9ecef"
      }}>
        <h4 style={{ margin: "0 0 10px 0", color: "#495057" }}>余额信息</h4>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
          <div>
            <span style={{ fontWeight: "bold", color: "#6c757d" }}>Permit2授权:</span>
            <br />
            <span style={{ color: "#28a745" }}>
              {tokenAllowance === maxUint256 ? "无限授权" : formatEther(tokenAllowance || 0n)}
            </span>
          </div>
          <div>
            <span style={{ fontWeight: "bold", color: "#6c757d" }}>钱包余额:</span>
            <br />
            <span style={{ color: "#007bff" }}>{formatEther(tokenBalance || 0n)}</span>
          </div>
          <div>
            <span style={{ fontWeight: "bold", color: "#6c757d" }}>银行余额:</span>
            <br />
            <span style={{ color: "#fd7e14" }}>{formatEther(bankBalance || 0n)}</span>
          </div>
        </div>
      </div>
      
      <button 
        onClick={handleDeposit} 
        disabled={!canDeposit}
        style={{
          padding: "12px 24px",
          backgroundColor: canDeposit ? "#007bff" : "#6c757d",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: canDeposit ? "pointer" : "not-allowed",
          fontSize: "16px",
          fontWeight: "bold",
          transition: "background-color 0.2s"
        }}
        onMouseOver={(e) => {
          if (canDeposit) {
            e.currentTarget.style.backgroundColor = "#0056b3";
          }
        }}
        onMouseOut={(e) => {
          if (canDeposit) {
            e.currentTarget.style.backgroundColor = "#007bff";
          }
        }}
      >
        {isPending ? "处理中..." : "使用Permit2存入代币"}
      </button>
      
      {!canDeposit && !isPending && (
        <div style={{ marginTop: "10px", color: "#6c757d", fontSize: "14px" }}>
          {chainId !== undefined && BigInt(chainId) !== workChainId && "❌ 请切换到正确的链"}
          {(!token || !isAddress(token)) && "❌ 请输入有效的代币地址"}
          {amount <= 0n && "❌ 请输入有效的存入数量"}
          {tokenBalance !== null && tokenBalance < amount && "❌ 钱包余额不足"}
        </div>
      )}
      
      {msg && (
        <div style={{ 
          border: "1px solid #007bff", 
          padding: "15px", 
          marginTop: "15px",
          backgroundColor: "#f0f8ff",
          borderRadius: "8px",
          whiteSpace: "pre-line",
          fontFamily: "monospace",
          fontSize: "14px",
          maxHeight: "200px",
          overflowY: "auto"
        }}>
          <h4 style={{ margin: "0 0 10px 0", color: "#007bff" }}>交易日志</h4>
          <span>{msg}</span>
        </div>
      )}
    </>
  );
}