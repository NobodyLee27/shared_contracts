// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

/**
 * 0.8 之前的合约上溢/下溢
 * 
 * 例如 uint8 最大值为 255，当执行 255 + 1 时，会溢出，结果为 0 255 + 2 = 2
 * 利用上溢 可以执行任意操作，例如：花费 $1 之后 $2^256-1
 */

contract MathOverflowAttactk {
    mapping (address => uint) balances;
    uint public totalSupply;

    constructor (uint _initialSupply) {
        balances[msg.sender] = totalSupply = _initialSupply;
    }

    function transfer(address _to, uint _value) public returns (bool) {
        // https://github.com/OpenZeppelin/openzeppelin-contracts/blob/release-v4.9/contracts/utils/math/SafeMath.sol
        unchecked {
            // 0.8 之前的版本 会导致 整型溢出 无限转账
            require(balances[msg.sender] - _value >= 0);
            balances[msg.sender] -= _value;
            balances[_to] += _value;
        }
        return true;
    }

    function overflowExample() public pure returns (uint8[4] memory) { 
        uint8[4] memory results;
        unchecked {
            // 上溢示例
            uint8 a = 255; // uint8 最大值
            results[0] = a;
            
            a = a + 1; // 255 + 1 = 0 (溢出)
            results[1] = a;
            
            // 继续上溢
            a = a + 254; // 0 + 254 = 254
            results[2] = a;
            
            // 下溢示例
            uint8 b = 0; // uint8 最小值
            b = b - 1; // 0 - 1 = 255 (下溢)
            results[3] = b;
        }
         return results; // 返回 [255, 0, 254, 255]
    }
}