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
        balances[msg.sender][address(token)] += amount;
    }
    
    function deposit(IERC20 token, uint256 amount) external {
        token.transferFrom(msg.sender, address(this), amount);
        balances[msg.sender][address(token)] += amount;
    }

    function withdraw(IERC20 token, uint256 amount) public {
        uint256 b = balances[msg.sender][address(token)];
        require(b >= amount, "Insufficient balance");
        balances[msg.sender][address(token)] = b - amount;
        SafeERC20.safeTransfer(token, msg.sender, amount);
    }
}