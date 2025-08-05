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
import { useAccount, useSignTypedData, useConfig, useConnect, useDisconnect } from "wagmi";
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

type MessageType = 'info' | 'success' | 'error' | 'warning';

interface Message {
  text: string;
  type: MessageType;
  timestamp: number;
}

export default function WagmiSignPermit2() {
  const tokenBank = getAddress("0xf04DA1FfDA455F24cD217fbb2dFE2A079e15e02b");
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const loginAccount = useAccount();
  const config = useConfig();
  const { signTypedDataAsync } = useSignTypedData();

  const [messages, setMessages] = useState<Message[]>([]);
  const [token, setToken] = useState<string>("");
  const [amount, setAmount] = useState(0n);
  const [isPending, setIsPending] = useState(false);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);

  const [tokenAllowance, setTokenAllowance] = useState<bigint | null>(null);
  const [tokenBalance, setTokenBalance] = useState<bigint | null>(null);
  const [bankBalance, setBankBalance] = useState<bigint | null>(null);
  const [tokenInfo, setTokenInfo] = useState<{name: string, symbol: string} | null>(null);

  useEffect(() => {
    if (isAddress(token) && loginAccount.address) {
      setIsLoadingBalances(true);
      
      Promise.all([
        // 获取代币信息
        readContract(config, {
          address: token,
          abi: erc20ABI,
          functionName: "name",
        }),
        readContract(config, {
          address: token,
          abi: erc20ABI,
          functionName: "symbol",
        }),
        // 获取用户对Permit2的授权额度
        readContract(config, {
          address: token,
          abi: erc20ABI,
          functionName: "allowance",
          args: [loginAccount.address, domain.verifyingContract],
        }),
        // 获取用户的代币余额
        readContract(config, {
          address: token,
          abi: erc20ABI,
          functionName: "balanceOf",
          args: [loginAccount.address],
        }),
        // 获取用户在TokenBank中的余额
        readContract(config, {
          address: tokenBank,
          abi: tokenBankABI,
          functionName: "balances",
          args: [loginAccount.address, token],
        })
      ]).then(([name, symbol, allowance, balance, bankBal]) => {
        setTokenInfo({ name: name as string, symbol: symbol as string });
        setTokenAllowance(allowance as bigint);
        setTokenBalance(balance as bigint);
        setBankBalance(bankBal as bigint);
      }).catch((error) => {
        console.error(error);
        addMessage("获取代币信息失败", 'error');
      }).finally(() => {
        setIsLoadingBalances(false);
      });
    } else {
      setTokenInfo(null);
      setTokenAllowance(null);
      setTokenBalance(null);
      setBankBalance(null);
    }
  }, [token, loginAccount.address, config, tokenBank]);

  const chainId = loginAccount && loginAccount.chainId;
  const isCorrectChain = chainId !== undefined && BigInt(chainId) === workChainId;
  const canDeposit =
    isCorrectChain &&
    !isPending &&
    !isLoadingBalances &&
    token !== null &&
    isAddress(token) &&
    amount > 0n &&
    tokenBalance !== null &&
    tokenBalance >= amount;

  const addMessage = (text: string, type: MessageType = 'info') => {
    const newMessage: Message = {
      text,
      type,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, newMessage].slice(-5)); // 只保留最近5条消息
  };

  const clearMessages = () => {
    setMessages([]);
  };

  const handleDeposit = async () => {
    if (isPending) return;

    try {
      setIsPending(true);
      clearMessages();
      
      if (token == null) return;
      if (!isAddress(token)) return;
      if (tokenAllowance == null) return;
      if (tokenBalance == null) return;

      // 检查用户余额是否足够
      if (tokenBalance < amount) {
        addMessage("钱包余额不足", 'error');
        return;
      }

      // 1. 检查对Permit2的授权
      if (tokenAllowance < amount) {
        addMessage("需要先授权给Permit2合约...", 'warning');
        
        const approveHash = await writeContract(config, {
          address: token!,
          abi: erc20ABI,
          functionName: "approve",
          args: [domain.verifyingContract, maxUint256],
        });
        
        addMessage(`授权交易已提交: ${approveHash.slice(0, 10)}...`, 'info');
        
        const approveReceipt = await waitForTransactionReceipt(config, { hash: approveHash });
        setTokenAllowance(maxUint256);
        addMessage(`授权成功！`, 'success');
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

      addMessage(`请在钱包中签署Permit授权...`, 'info');
      
      const signature = await signTypedDataAsync({
        types: types,
        primaryType: "PermitTransferFrom",
        message: permit,
        domain: domain,
      });
      
      addMessage(`Permit签名完成！`, 'success');
      addMessage("正在执行存款交易...", 'info');
      
      // 3. 使用Permit2进行存款
      const depositHash = await writeContract(config, {
        address: tokenBank,
        abi: tokenBankABI,
        functionName: "depositWithPermit2",
        args: [token, amount, permit, signature],
      });
      
      addMessage(`存款交易已提交: ${depositHash.slice(0, 10)}...`, 'info');
      
      const depositReceipt = await waitForTransactionReceipt(config, { hash: depositHash });
      addMessage(`存款成功！交易哈希: ${depositHash.slice(0, 10)}...`, 'success');

      // 更新余额信息
      if (loginAccount.address) {
        const [newTokenBalance, newBankBalance] = await Promise.all([
          readContract(config, {
            address: token,
            abi: erc20ABI,
            functionName: "balanceOf",
            args: [loginAccount.address],
          }),
          readContract(config, {
            address: tokenBank,
            abi: tokenBankABI,
            functionName: "balances",
            args: [loginAccount.address, token],
          })
        ]);
        
        setTokenBalance(newTokenBalance);
        setBankBalance(newBankBalance);
        setAmount(0n); // 重置输入金额
      }
    } catch (error: any) {
      console.error(error);
      if (error && error.shortMessage) {
        addMessage(`错误: ${error.shortMessage}`, 'error');
      } else {
        addMessage(`错误: ${stringify(error)}`, 'error');
      }
    } finally {
      setIsPending(false);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getMessageColor = (type: MessageType) => {
    switch (type) {
      case 'success': return '#10b981';
      case 'error': return '#ef4444';
      case 'warning': return '#f59e0b';
      default: return '#3b82f6';
    }
  };

  return (
    <div style={{
      maxWidth: '600px',
      margin: '0 auto',
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* 标题 */}
      <div style={{
        textAlign: 'center',
        marginBottom: '30px'
      }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: '700',
          color: '#1f2937',
          margin: '0 0 8px 0'
        }}>Token Bank Permit2</h1>
        <p style={{
          color: '#6b7280',
          margin: 0,
          fontSize: '16px'
        }}>使用Permit2的无Gas授权存款服务</p>
      </div>

      {/* 钱包连接卡片 */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '20px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <h3 style={{
          margin: '0 0 15px 0',
          fontSize: '18px',
          fontWeight: '600',
          color: '#1f2937'
        }}>钱包连接</h3>
        
        {loginAccount.status === 'connected' ? (
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px'
            }}>
              <div>
                <div style={{ fontSize: '14px', color: '#6b7280' }}>已连接地址</div>
                <div style={{ fontSize: '16px', fontWeight: '500', color: '#1f2937' }}>
                  {formatAddress(loginAccount.address!)}
                </div>
              </div>
              <button 
                onClick={() => disconnect()}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                断开连接
              </button>
            </div>
            
            <div style={{
              display: 'flex',
              gap: '20px',
              fontSize: '14px',
              color: '#6b7280'
            }}>
              <span>状态: <span style={{ color: '#10b981', fontWeight: '500' }}>已连接</span></span>
              <span>链ID: {loginAccount.chainId}</span>
            </div>
            
            {!isCorrectChain && (
              <div style={{
                marginTop: '10px',
                padding: '10px',
                backgroundColor: '#fef3c7',
                border: '1px solid #f59e0b',
                borderRadius: '8px',
                color: '#92400e',
                fontSize: '14px'
              }}>
                ⚠️ 请切换到链 {workChainId.toString()}
              </div>
            )}
          </div>
        ) : (
          <div>
            <p style={{ margin: '0 0 15px 0', color: '#6b7280' }}>请连接钱包以继续</p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {connectors.map((connector) => (
                <button
                  key={connector.uid}
                  onClick={() => connect({ connector })}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  连接 {connector.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Permit2说明卡片 */}
      {loginAccount.status === 'connected' && isCorrectChain && (
        <div style={{
          backgroundColor: '#f0f9ff',
          border: '1px solid #0ea5e9',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '8px'
          }}>
            <span style={{ fontSize: '18px' }}>ℹ️</span>
            <h4 style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: '600',
              color: '#0c4a6e'
            }}>关于Permit2</h4>
          </div>
          <p style={{
            margin: 0,
            fontSize: '14px',
            color: '#0c4a6e',
            lineHeight: '1.5'
          }}>
            Permit2允许您通过签名授权代币转移，无需单独的授权交易。首次使用需要授权给Permit2合约，之后的存款只需签名即可完成。
          </p>
        </div>
      )}

      {/* 存款操作卡片 */}
      {loginAccount.status === 'connected' && isCorrectChain && (
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <h3 style={{
            margin: '0 0 20px 0',
            fontSize: '18px',
            fontWeight: '600',
            color: '#1f2937'
          }}>Permit2存款操作</h3>
          
          {/* 代币地址输入 */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151'
            }}>代币地址</label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="输入ERC20代币地址"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
            {tokenInfo && (
              <div style={{
                marginTop: '8px',
                fontSize: '12px',
                color: '#10b981'
              }}>
                ✓ {tokenInfo.name} ({tokenInfo.symbol})
              </div>
            )}
          </div>

          {/* 存入数量输入 */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151'
            }}>存入数量</label>
            <input
              type="number"
              value={formatEther(amount)}
              onChange={(e) => setAmount(parseEther(e.target.value || "0"))}
              placeholder="输入存入数量"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* 余额信息 */}
          {isAddress(token) && (
            <div style={{
              backgroundColor: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <h4 style={{
                margin: '0 0 12px 0',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151'
              }}>余额信息</h4>
              
              {isLoadingBalances ? (
                <div style={{ color: '#6b7280', fontSize: '14px' }}>加载中...</div>
              ) : (
                <div style={{ display: 'grid', gap: '8px', fontSize: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6b7280' }}>钱包余额:</span>
                    <span style={{ fontWeight: '500' }}>{formatEther(tokenBalance || 0n)} {tokenInfo?.symbol || ''}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6b7280' }}>银行余额:</span>
                    <span style={{ fontWeight: '500' }}>{formatEther(bankBalance || 0n)} {tokenInfo?.symbol || ''}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6b7280' }}>Permit2授权:</span>
                    <span style={{ fontWeight: '500', color: tokenAllowance === maxUint256 ? '#10b981' : '#f59e0b' }}>
                      {tokenAllowance === maxUint256 ? '✓ 无限授权' : formatEther(tokenAllowance || 0n)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 存款按钮 */}
          <button 
            onClick={handleDeposit} 
            disabled={!canDeposit}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: canDeposit ? '#8b5cf6' : '#d1d5db',
              color: canDeposit ? 'white' : '#9ca3af',
              border: 'none',
              borderRadius: '8px',
              cursor: canDeposit ? 'pointer' : 'not-allowed',
              fontSize: '16px',
              fontWeight: '600',
              transition: 'background-color 0.2s'
            }}
          >
            {isPending ? '处理中...' : '使用Permit2存入代币'}
          </button>
          
          {/* 状态提示 */}
          {!canDeposit && !isPending && (
            <div style={{
              marginTop: '10px',
              fontSize: '12px',
              color: '#6b7280'
            }}>
              {!isCorrectChain && "❌ 请切换到正确的链"}
              {(!token || !isAddress(token)) && "❌ 请输入有效的代币地址"}
              {amount <= 0n && "❌ 请输入有效的存入数量"}
              {tokenBalance !== null && tokenBalance < amount && "❌ 钱包余额不足"}
              {isLoadingBalances && "⏳ 正在加载余额信息..."}
            </div>
          )}
        </div>
      )}

      {/* 消息日志 */}
      {messages.length > 0 && (
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '15px'
          }}>
            <h3 style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: '600',
              color: '#1f2937'
            }}>操作日志</h3>
            <button
              onClick={clearMessages}
              style={{
                padding: '4px 8px',
                backgroundColor: 'transparent',
                color: '#6b7280',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              清除
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {messages.map((message, index) => (
              <div
                key={index}
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: `${getMessageColor(message.type)}15`,
                  borderLeft: `3px solid ${getMessageColor(message.type)}`,
                  color: '#1f2937'
                }}
              >
                {message.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}