// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {Upgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";
import {MTC} from "../src/MTC.sol"; 

/**
 * @title MTCDeployer
 * @dev 部署脚本
 * @author Web3Gaming
 * forge clean && forge build
 */

contract MTCDeployerScript is Script {
    function run() external returns (address) {

        string memory privateKey = vm.envString("WEB3GAMING_PRIVATE_KEY");
        uint256 deployerPrivateKey = vm.parseUint(string.concat("0x", privateKey));
        address deployerAddress = vm.addr(deployerPrivateKey);
        console.log("Deploying contracts with the account: %s", deployerAddress);
        address initialOwner = deployerAddress; // 或者其他指定的owner地址

        bytes memory initData = abi.encodeWithSelector(
            MTC.initialize.selector,
            initialOwner
        );

        vm.startBroadcast(deployerPrivateKey);

        // 部署 UUPS 代理
        address proxy = Upgrades.deployUUPSProxy(
            "MTC.sol:MTC", // 合约文件名
            initData
        );

        vm.stopBroadcast();

        console.log("MTC Proxy deployed to:", proxy);
        console.log("MTC Implementation deployed to:", Upgrades.getImplementationAddress(proxy)); // 可选：获取实现地址
        console.log("MTC Owner set to:", initialOwner);

        return proxy;
    }
}