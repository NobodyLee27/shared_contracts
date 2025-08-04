// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Script, console} from "forge-std/Script.sol";
import { TokenBank } from "../src/TokenBank.sol";

// forge script script/TokenBankDepolyer.s.sol:TokenBankDeployer --rpc-url https://polygon-amoy.g.alchemy.com/v2/vkZ5WPCV0qB9Gye9sajMsn9YhdSl7Shy --private-key $WEB3GAMING_PRIVATE_KEY --broadcast --verify --etherscan-api-key 3B5VHH6EPJ17CQGFIHDT3BU5V4UNHIEVQB --priority-gas-price 30000000000

/**
* == Logs ==
  Deploying contracts with the account: 0x355eb1c3D6dF0642b3abe2785e821C574837C79f
  deploy token_bank: 0xf04DA1FfDA455F24cD217fbb2dFE2A079e15e02b
 */

contract TokenBankDeployer is Script {

    function run() public {
        string memory privateKey = vm.envString("WEB3GAMING_PRIVATE_KEY");
        uint256 deployerPrivateKey = vm.parseUint(string.concat("0x", privateKey));
        address deployerAddress = vm.addr(deployerPrivateKey);
        console.log("Deploying contracts with the account: %s", deployerAddress);

        vm.startBroadcast(deployerPrivateKey);

        // can not upgrade
        TokenBank token_bank = new TokenBank(0x000000000022D473030F116dDEE9F6B43aC78BA3);
        console.log("deploy token_bank:", address(token_bank));

        vm.stopBroadcast();
    }
}