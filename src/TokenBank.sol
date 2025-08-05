// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

struct TokenPermissions {
    address token;
    uint256 amount;
}

struct PermitTransferFrom {
    TokenPermissions permitted;
    uint256 nonce;
    uint256 deadline;
}

struct SignatureTransferDetails {
    address to;
    uint256 requestedAmount;
}

interface IPermit2 {
    function DOMAIN_SEPARATOR() external view returns (bytes32);
    function permitTransferFrom(
        PermitTransferFrom memory permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes calldata signature
    ) external;
}

contract TokenBank {
    IPermit2 public immutable permit2;

    mapping(address => mapping(address => uint256)) public balances;
    
    // 记录所有存入过的代币地址
    address[] public supportedTokens;
    mapping(address => bool) public isTokenSupported;
    
    // 记录每个代币的总存款量
    mapping(address => uint256) public totalDeposits;
    
    // 记录每个用户存入过的代币
    mapping(address => address[]) public userTokens;
    mapping(address => mapping(address => bool)) public hasUserToken;

    constructor(address _permit2) {
        require(_permit2 != address(0), "Invalid permit2");
        permit2 = IPermit2(_permit2);
    }

    function depositWithPermit2(
        IERC20 token,
        uint256 amount,
        PermitTransferFrom memory permit,
        bytes calldata signature
    ) public {
        uint256 balanceBefore = token.balanceOf(address(this));

        {
            SignatureTransferDetails memory transferDetails =
                SignatureTransferDetails({to: address(this), requestedAmount: amount});

            permit2.permitTransferFrom(permit, transferDetails, msg.sender, signature);
        }
        uint256 balanceAfter = token.balanceOf(address(this));
        require(balanceAfter - balanceBefore == amount, "Invalid token transfer");
        
        _updateBalances(address(token), msg.sender, amount);
    }
    
    function deposit(IERC20 token, uint256 amount) external {
        token.transferFrom(msg.sender, address(this), amount);
        _updateBalances(address(token), msg.sender, amount);
    }

    function withdraw(IERC20 token, uint256 amount) public {
        uint256 b = balances[msg.sender][address(token)];
        require(b >= amount, "Insufficient balance");
        balances[msg.sender][address(token)] = b - amount;
        totalDeposits[address(token)] -= amount;
        SafeERC20.safeTransfer(token, msg.sender, amount);
    }
    
    // 内部函数：更新余额和相关记录
    function _updateBalances(address token, address user, uint256 amount) internal {
        balances[user][token] += amount;
        totalDeposits[token] += amount;
        
        // 记录支持的代币
        if (!isTokenSupported[token]) {
            supportedTokens.push(token);
            isTokenSupported[token] = true;
        }
        
        // 记录用户的代币
        if (!hasUserToken[user][token]) {
            userTokens[user].push(token);
            hasUserToken[user][token] = true;
        }
    }

    // ========== 读取变量的方法 ==========
    
    /**
     * @dev 获取用户在指定代币的余额
     * @param user 用户地址
     * @param token 代币地址
     * @return 用户余额
     */
    function getUserBalance(address user, address token) external view returns (uint256) {
        return balances[user][token];
    }
    
    /**
     * @dev 获取用户的所有代币余额
     * @param user 用户地址
     * @return tokens 代币地址数组
     * @return amounts 对应的余额数组
     */
    function getUserAllBalances(address user) external view returns (address[] memory tokens, uint256[] memory amounts) {
        address[] memory userTokenList = userTokens[user];
        uint256 length = userTokenList.length;
        
        tokens = new address[](length);
        amounts = new uint256[](length);
        
        for (uint256 i = 0; i < length; i++) {
            tokens[i] = userTokenList[i];
            amounts[i] = balances[user][userTokenList[i]];
        }
    }
    
    /**
     * @dev 获取指定代币的总存款量
     * @param token 代币地址
     * @return 总存款量
     */
    function getTotalDeposits(address token) external view returns (uint256) {
        return totalDeposits[token];
    }
    
    /**
     * @dev 获取所有支持的代币列表
     * @return 代币地址数组
     */
    function getSupportedTokens() external view returns (address[] memory) {
        return supportedTokens;
    }
    
    /**
     * @dev 获取支持的代币数量
     * @return 代币数量
     */
    function getSupportedTokensCount() external view returns (uint256) {
        return supportedTokens.length;
    }
    
    /**
     * @dev 检查代币是否被支持
     * @param token 代币地址
     * @return 是否支持
     */
    function isTokenSupportedByBank(address token) external view returns (bool) {
        return isTokenSupported[token];
    }
    
    /**
     * @dev 获取用户存入过的代币列表
     * @param user 用户地址
     * @return 代币地址数组
     */
    function getUserTokens(address user) external view returns (address[] memory) {
        return userTokens[user];
    }
    
    /**
     * @dev 获取用户存入过的代币数量
     * @param user 用户地址
     * @return 代币数量
     */
    function getUserTokensCount(address user) external view returns (uint256) {
        return userTokens[user].length;
    }
    
    /**
     * @dev 检查用户是否持有指定代币
     * @param user 用户地址
     * @param token 代币地址
     * @return 是否持有
     */
    function doesUserHaveToken(address user, address token) external view returns (bool) {
        return hasUserToken[user][token];
    }
    
    /**
     * @dev 获取合约在指定代币的实际余额
     * @param token 代币地址
     * @return 合约实际余额
     */
    function getContractTokenBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
    
    /**
     * @dev 获取所有代币的总存款信息
     * @return tokens 代币地址数组
     * @return totalAmounts 对应的总存款数组
     */
    function getAllTokenDeposits() external view returns (address[] memory tokens, uint256[] memory totalAmounts) {
        uint256 length = supportedTokens.length;
        tokens = new address[](length);
        totalAmounts = new uint256[](length);
        
        for (uint256 i = 0; i < length; i++) {
            tokens[i] = supportedTokens[i];
            totalAmounts[i] = totalDeposits[supportedTokens[i]];
        }
    }
    
    /**
     * @dev 获取Permit2合约地址
     * @return Permit2合约地址
     */
    function getPermit2Address() external view returns (address) {
        return address(permit2);
    }
}