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

// TokenBank合约ABI
const tokenBankABI = parseAbi([
  "function deposit(address token, uint256 amount) external",
  "function withdraw(address token, uint256 amount) external",
  "function getUserBalance(address user, address token) external view returns (uint256)",
  "function balances(address user, address token) external view returns (uint256)",
]);

// const workChainId = 80002n;
// const workChainId = 11155111n;
const workChainId = 421614n;


type MessageType = 'info' | 'success' | 'error' | 'warning';

interface Message {
  text: string;
  type: MessageType;
  timestamp: number;
}

export default function WagmiApprove() {
  
  // eth
  // const tokenBank = getAddress("0x53191344e115a119383A2eED003Db814F147F46B");
  // polygon
  // const tokenBank = getAddress("0x085De1616D11610220293Df29Ba7854477532426");

  // arbitrum
  const tokenBank = getAddress("0x25463AEc4cc8a03EB11a57366AA70D26844Eb325");

  const loginAccount = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const config = useConfig();

  const [messages, setMessages] = useState<Message[]>([]);
  const [token, setToken] = useState<string>("");
  const [limitedAmount, setLimitedAmount] = useState(0n);
  const [depositAmount, setDepositAmount] = useState(0n);
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
        // 获取用户对TokenBank的授权额度
        readContract(config, {
          address: token,
          abi: erc20ABI,
          functionName: "allowance",
          args: [loginAccount.address, tokenBank],
        }),
        // 获取用户的代币余额
        readContract(config, {
          address: token,
          abi: erc20ABI,
          functionName: "balanceOf",
          args: [loginAccount.address],
        }),
        // 获取用户在TokenBank的余额
        readContract(config, {
          address: tokenBank,
          abi: tokenBankABI,
          functionName: "getUserBalance",
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
  const canApprove = isCorrectChain && !isPending && !isLoadingBalances && token !== null && isAddress(token);
  const canLimitedApprove = canApprove && limitedAmount > 0n && tokenBalance !== null && tokenBalance >= limitedAmount;
  const canDeposit = canApprove && depositAmount > 0n && tokenBalance !== null && tokenBalance >= depositAmount && tokenAllowance !== null && tokenAllowance >= depositAmount;

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

  const handleUnlimitedApprove = async () => {
    if (isPending) return;

    try {
      setIsPending(true);
      clearMessages();
      
      if (token == null) return;
      if (!isAddress(token)) return;

      addMessage("正在进行无限制授权...", 'info');
      
      const approveHash = await writeContract(config, {
        address: token!,
        abi: erc20ABI,
        functionName: "approve",
        args: [tokenBank, maxUint256],
      });
      
      addMessage(`无限制授权交易已提交: ${approveHash.slice(0, 10)}...`, 'info');
      
      const approveReceipt = await waitForTransactionReceipt(config, { hash: approveHash });
      setTokenAllowance(maxUint256);
      addMessage(`无限制授权成功！交易哈希: ${approveHash.slice(0, 10)}...`, 'success');

    } catch (error: any) {
      console.error(error);
      if (error && error.shortMessage) {
        addMessage(`授权失败: ${error.shortMessage}`, 'error');
      } else {
        addMessage(`授权失败: ${stringify(error)}`, 'error');
      }
    } finally {
      setIsPending(false);
    }
  };

  const handleLimitedApprove = async () => {
    if (isPending) return;

    try {
      setIsPending(true);
      clearMessages();
      
      if (token == null) return;
      if (!isAddress(token)) return;
      if (limitedAmount <= 0n) return;

      addMessage(`正在进行限制授权 ${formatEther(limitedAmount)} ${tokenInfo?.symbol || ''}...`, 'info');
      
      const approveHash = await writeContract(config, {
        address: token!,
        abi: erc20ABI,
        functionName: "approve",
        args: [tokenBank, limitedAmount],
      });
      
      addMessage(`限制授权交易已提交: ${approveHash.slice(0, 10)}...`, 'info');
      
      const approveReceipt = await waitForTransactionReceipt(config, { hash: approveHash });
      setTokenAllowance(limitedAmount);
      addMessage(`限制授权成功！授权金额: ${formatEther(limitedAmount)} ${tokenInfo?.symbol || ''}`, 'success');
      setLimitedAmount(0n); // 重置输入金额

    } catch (error: any) {
      console.error(error);
      if (error && error.shortMessage) {
        addMessage(`授权失败: ${error.shortMessage}`, 'error');
      } else {
        addMessage(`授权失败: ${stringify(error)}`, 'error');
      }
    } finally {
      setIsPending(false);
    }
  };

  const handleDeposit = async () => {
    if (isPending) return;

    try {
      setIsPending(true);
      clearMessages();
      
      if (token == null) return;
      if (!isAddress(token)) return;
      if (depositAmount <= 0n) return;

      addMessage(`正在存款 ${formatEther(depositAmount)} ${tokenInfo?.symbol || ''}...`, 'info');
      
      const depositHash = await writeContract(config, {
        address: tokenBank,
        abi: tokenBankABI,
        functionName: "deposit",
        args: [token, depositAmount],
      });
      
      addMessage(`存款交易已提交: ${depositHash.slice(0, 10)}...`, 'info');
      
      const depositReceipt = await waitForTransactionReceipt(config, { hash: depositHash });
      
      // 更新余额
      setBankBalance((prev) => (prev || 0n) + depositAmount);
      setTokenBalance((prev) => (prev || 0n) - depositAmount);
      
      addMessage(`存款成功！存款金额: ${formatEther(depositAmount)} ${tokenInfo?.symbol || ''}`, 'success');
      setDepositAmount(0n); // 重置输入金额

    } catch (error: any) {
      console.error(error);
      if (error && error.shortMessage) {
        addMessage(`存款失败: ${error.shortMessage}`, 'error');
      } else {
        addMessage(`存款失败: ${stringify(error)}`, 'error');
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
        }}>Token Bank Manager</h1>
        <p style={{
          color: '#6b7280',
          margin: 0,
          fontSize: '16px'
        }}>代币银行管理工具</p>
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

      {/* 授权和存款操作卡片 */}
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
          }}>代币操作</h3>
          
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
              }}>代币信息</h4>
              
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
                    <span style={{ color: '#6b7280' }}>当前授权额度:</span>
                    <span style={{ fontWeight: '500' }}>
                      {tokenAllowance === maxUint256 ? '无限制' : formatEther(tokenAllowance || 0n)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6b7280' }}>授权对象:</span>
                    <span style={{ fontWeight: '500', fontSize: '12px' }}>{formatAddress(tokenBank)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 无限制授权按钮 */}
          <div style={{ marginBottom: '20px' }}>
            <button 
              onClick={handleUnlimitedApprove} 
              disabled={!canApprove}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: canApprove ? '#10b981' : '#d1d5db',
                color: canApprove ? 'white' : '#9ca3af',
                border: 'none',
                borderRadius: '8px',
                cursor: canApprove ? 'pointer' : 'not-allowed',
                fontSize: '16px',
                fontWeight: '600',
                transition: 'background-color 0.2s',
                marginBottom: '8px'
              }}
            >
              {isPending ? '处理中...' : '无限制授权'}
            </button>
            <div style={{
              fontSize: '12px',
              color: '#6b7280',
              textAlign: 'center'
            }}>
              一次授权，永久有效（推荐用于信任的合约）
            </div>
          </div>

          {/* 限制授权部分 */}
          <div style={{
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '16px',
            backgroundColor: '#fafafa',
            marginBottom: '20px'
          }}>
            <h4 style={{
              margin: '0 0 12px 0',
              fontSize: '16px',
              fontWeight: '600',
              color: '#374151'
            }}>限制授权</h4>
            
            {/* 限制授权金额输入 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151'
              }}>授权金额</label>
              <input
                type="number"
                value={formatEther(limitedAmount)}
                onChange={(e) => setLimitedAmount(parseEther(e.target.value || "0"))}
                placeholder="输入授权金额"
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

            {/* 限制授权按钮 */}
            <button 
              onClick={handleLimitedApprove} 
              disabled={!canLimitedApprove}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: canLimitedApprove ? '#3b82f6' : '#d1d5db',
                color: canLimitedApprove ? 'white' : '#9ca3af',
                border: 'none',
                borderRadius: '8px',
                cursor: canLimitedApprove ? 'pointer' : 'not-allowed',
                fontSize: '16px',
                fontWeight: '600',
                transition: 'background-color 0.2s',
                marginBottom: '8px'
              }}
            >
              {isPending ? '处理中...' : '限制授权'}
            </button>
            <div style={{
              fontSize: '12px',
              color: '#6b7280',
              textAlign: 'center'
            }}>
              只授权指定金额，更加安全
            </div>
          </div>

          {/* 存款部分 */}
          <div style={{
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '16px',
            backgroundColor: '#f0f9ff'
          }}>
            <h4 style={{
              margin: '0 0 12px 0',
              fontSize: '16px',
              fontWeight: '600',
              color: '#374151'
            }}>存款到TokenBank</h4>
            
            {/* 存款金额输入 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151'
              }}>存款金额</label>
              <input
                type="number"
                value={formatEther(depositAmount)}
                onChange={(e) => setDepositAmount(parseEther(e.target.value || "0"))}
                placeholder="输入存款金额"
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

            {/* 存款条件检查 */}
            {isAddress(token) && depositAmount > 0n && (
              <div style={{
                marginBottom: '16px',
                fontSize: '12px',
                color: '#6b7280'
              }}>
                {tokenAllowance === null || tokenAllowance < depositAmount ? (
                  <div style={{ color: '#ef4444' }}>⚠️ 授权额度不足，请先进行授权</div>
                ) : tokenBalance === null || tokenBalance < depositAmount ? (
                  <div style={{ color: '#ef4444' }}>⚠️ 钱包余额不足</div>
                ) : (
                  <div style={{ color: '#10b981' }}>✓ 可以进行存款</div>
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
                backgroundColor: canDeposit ? '#0ea5e9' : '#d1d5db',
                color: canDeposit ? 'white' : '#9ca3af',
                border: 'none',
                borderRadius: '8px',
                cursor: canDeposit ? 'pointer' : 'not-allowed',
                fontSize: '16px',
                fontWeight: '600',
                transition: 'background-color 0.2s',
                marginBottom: '8px'
              }}
            >
              {isPending ? '处理中...' : '存款'}
            </button>
            <div style={{
              fontSize: '12px',
              color: '#6b7280',
              textAlign: 'center'
            }}>
              将代币存入TokenBank合约
            </div>
          </div>
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