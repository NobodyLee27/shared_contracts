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
import { useAccount, useConfig, useConnect, useDisconnect } from "wagmi";
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
  "function deposit(address token, uint256 amount) external",
  "function balances(address user, address token) view returns (uint256)",
]);

const workChainId = 80002n;

export default function WagmiSign() {
  const tokenBank = getAddress("0xf04DA1FfDA455F24cD217fbb2dFE2A079e15e02b");
  const loginAccount = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const config = useConfig();

  const [msg, setMsg] = useState<string | null>(null);
  const [token, setToken] = useState<string>("");
  const [amount, setAmount] = useState(0n);
  const [isPending, setIsPending] = useState(false);

  const [tokenAllowance, setTokenAllowance] = useState<bigint | null>(null);
  const [tokenBalance, setTokenBalance] = useState<bigint | null>(null);
  const [bankBalance, setBankBalance] = useState<bigint | null>(null);

  useEffect(() => {
    if (isAddress(token) && loginAccount.address) {
      // 获取用户对TokenBank的授权额度
      readContract(config, {
        address: token,
        abi: erc20ABI,
        functionName: "allowance",
        args: [loginAccount.address, tokenBank],
      }).then((result) => {
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
        printLog("余额不足");
        return;
      }

      // 1. 检查授权额度，如果不够则先进行授权
      if (tokenAllowance < amount) {
        printLog("授权额度不足，正在进行授权...");
        // 发送授权交易
        const approveHash = await writeContract(config, {
          address: token!,
          abi: erc20ABI,
          functionName: "approve",
          args: [tokenBank, maxUint256],
        });
        console.log("approve hash", approveHash);
        const approveReceipt = await waitForTransactionReceipt(config, { hash: approveHash });
        console.log("approve receipt", approveReceipt);
        // 更新授权额度
        setTokenAllowance(maxUint256);
        printLog(`授权成功: ${approveHash}`);
      }

      // 2. 调用TokenBank的deposit函数
      printLog("正在存入代币...");
      const depositHash = await writeContract(config, {
        address: tokenBank,
        abi: tokenBankABI,
        functionName: "deposit",
        args: [token, amount],
      });
      console.log("deposit hash", depositHash);
      const depositReceipt = await waitForTransactionReceipt(config, { hash: depositHash });
      console.log("deposit receipt", depositReceipt);
      printLog(`存入成功: ${depositHash}`);

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
      <h2>Token Bank 传统存款</h2>
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
        <span>请切换到链 {workChainId.toString()}</span>
      )}
      <br />
      <div>
        <label>代币地址:</label>
        <input
          type="text"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="输入ERC20代币地址"
          style={{ width: "400px", marginLeft: "10px" }}
        />
      </div>
      <br />
      <div>
        <label>存入数量:</label>
        <input
          type="number"
          value={formatEther(amount)}
          onChange={(e) => setAmount(parseEther(e.target.value || "0"))}
          placeholder="输入存入数量"
          style={{ marginLeft: "10px" }}
        />
      </div>
      <br />
      <div>
        <span>授权额度: {formatEther(tokenAllowance || 0n)} </span>
        <br />
        <span>钱包余额: {formatEther(tokenBalance || 0n)} </span>
        <br />
        <span>银行余额: {formatEther(bankBalance || 0n)} </span>
      </div>
      <br />
      <button 
        onClick={handleDeposit} 
        disabled={!canDeposit}
        style={{
          padding: "10px 20px",
          backgroundColor: canDeposit ? "#007bff" : "#ccc",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: canDeposit ? "pointer" : "not-allowed"
        }}
      >
        {isPending ? "处理中..." : "存入代币"}
      </button>
      {msg && (
        <div style={{ 
          border: "1px solid blue", 
          padding: "10px", 
          marginTop: "10px",
          backgroundColor: "#f0f8ff",
          whiteSpace: "pre-line"
        }}>
          <span>{msg}</span>
        </div>
      )}
    </>
  );
}