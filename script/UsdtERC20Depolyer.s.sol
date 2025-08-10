// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Script, console} from "forge-std/Script.sol";
import { UsdtERC20 } from "../src/UsdtERC20.sol";

// forge script script/UsdtERC20Depolyer.s.sol:IERC20Deployer --rpc-url $WEB3GAMING_ALCHEMY_RPC_URL --private-key $WEB3GAMING_PRIVATE_KEY --broadcast --verify --etherscan-api-key $WEB3GAMING_ETHERSCAN_API_KEY
// == Logs ==
//   Deploying contracts with the account: 0x355eb1c3D6dF0642b3abe2785e821C574837C79f
//   deploy usdt_token: 0xF444f85eb14BE0d2f666b0fd3136052bb00baCfe
//   deploy deployerAddress balance: 12345678910000000000000000000
//   deploy deployerAddress balance: 12345678910000000000000000000

// forge script script/UsdtERC20Depolyer.s.sol:IERC20Deployer --rpc-url https://arb-sepolia.g.alchemy.com/v2/vkZ5WPCV0qB9Gye9sajMsn9YhdSl7Shy --private-key $WEB3GAMING_PRIVATE_KEY --broadcast --verify --etherscan-api-key DMUEFJ91EEYGRDE64MQZU6IQZD3ASHINUY
// == Logs ==
//   Deploying contracts with the account: 0x355eb1c3D6dF0642b3abe2785e821C574837C79f
//   deploy usdt_token: 0x46a71622b04EacaE26548e3952074b7A90176e5B
//   deploy deployerAddress balance: 12345678910000000000000000000
//   deploy deployerAddress balance: 12345678910000000000000000000

// forge script script/UsdtERC20Depolyer.s.sol:IERC20Deployer --rpc-url https://polygon-amoy.g.alchemy.com/v2/vkZ5WPCV0qB9Gye9sajMsn9YhdSl7Shy --private-key $WEB3GAMING_PRIVATE_KEY --broadcast --verify --etherscan-api-key 3B5VHH6EPJ17CQGFIHDT3BU5V4UNHIEVQB --priority-gas-price 30000000000

// == Logs ==
//   Deploying contracts with the account: 0x355eb1c3D6dF0642b3abe2785e821C574837C79f
//   deploy usdt_token: 0x0f404eF20C8CC6347ce2d2cD8dc872b3093bdccB
//   deploy deployerAddress balance: 12345678910000000000000000000
//   deploy deployerAddress balance: 12345678910000000000000000000

contract IERC20Deployer is Script {

    function run() public {
       string memory privateKey = vm.envString("WEB3GAMING_PRIVATE_KEY");
        uint256 deployerPrivateKey = vm.parseUint(string.concat("0x", privateKey));
        address deployerAddress = vm.addr(deployerPrivateKey);
        console.log("Deploying contracts with the account: %s", deployerAddress);

        vm.startBroadcast(deployerPrivateKey);

        // can not upgrade
        IERC20 usdt_token = new UsdtERC20("USDT", "USDT", 12345678910 * 1e18, deployerAddress);
        console.log("deploy usdt_token:", address(usdt_token));
        console.log("deploy deployerAddress balance:", usdt_token.balanceOf(deployerAddress));

        // usdt_token.transfer(testAddress, 1000 * 1e18);
        console.log("deploy deployerAddress balance:", usdt_token.balanceOf(deployerAddress));
        // console.log("deploy testAddress balance:", usdt_token.balanceOf(testAddress));

        vm.stopBroadcast();
    }
}
