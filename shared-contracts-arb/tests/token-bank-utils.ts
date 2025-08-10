import { newMockEvent } from "matchstick-as"
import { ethereum, Address, BigInt } from "@graphprotocol/graph-ts"
import {
  Deposit,
  DepositWithPermit2,
  TokenSupported,
  UserTokenAdded,
  Withdraw
} from "../generated/TokenBank/TokenBank"

export function createDepositEvent(
  user: Address,
  token: Address,
  amount: BigInt,
  newBalance: BigInt,
  totalDeposit: BigInt
): Deposit {
  let depositEvent = changetype<Deposit>(newMockEvent())

  depositEvent.parameters = new Array()

  depositEvent.parameters.push(
    new ethereum.EventParam("user", ethereum.Value.fromAddress(user))
  )
  depositEvent.parameters.push(
    new ethereum.EventParam("token", ethereum.Value.fromAddress(token))
  )
  depositEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )
  depositEvent.parameters.push(
    new ethereum.EventParam(
      "newBalance",
      ethereum.Value.fromUnsignedBigInt(newBalance)
    )
  )
  depositEvent.parameters.push(
    new ethereum.EventParam(
      "totalDeposit",
      ethereum.Value.fromUnsignedBigInt(totalDeposit)
    )
  )

  return depositEvent
}

export function createDepositWithPermit2Event(
  user: Address,
  token: Address,
  amount: BigInt,
  nonce: BigInt,
  deadline: BigInt,
  newBalance: BigInt,
  totalDeposit: BigInt
): DepositWithPermit2 {
  let depositWithPermit2Event = changetype<DepositWithPermit2>(newMockEvent())

  depositWithPermit2Event.parameters = new Array()

  depositWithPermit2Event.parameters.push(
    new ethereum.EventParam("user", ethereum.Value.fromAddress(user))
  )
  depositWithPermit2Event.parameters.push(
    new ethereum.EventParam("token", ethereum.Value.fromAddress(token))
  )
  depositWithPermit2Event.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )
  depositWithPermit2Event.parameters.push(
    new ethereum.EventParam("nonce", ethereum.Value.fromUnsignedBigInt(nonce))
  )
  depositWithPermit2Event.parameters.push(
    new ethereum.EventParam(
      "deadline",
      ethereum.Value.fromUnsignedBigInt(deadline)
    )
  )
  depositWithPermit2Event.parameters.push(
    new ethereum.EventParam(
      "newBalance",
      ethereum.Value.fromUnsignedBigInt(newBalance)
    )
  )
  depositWithPermit2Event.parameters.push(
    new ethereum.EventParam(
      "totalDeposit",
      ethereum.Value.fromUnsignedBigInt(totalDeposit)
    )
  )

  return depositWithPermit2Event
}

export function createTokenSupportedEvent(
  token: Address,
  tokenCount: BigInt
): TokenSupported {
  let tokenSupportedEvent = changetype<TokenSupported>(newMockEvent())

  tokenSupportedEvent.parameters = new Array()

  tokenSupportedEvent.parameters.push(
    new ethereum.EventParam("token", ethereum.Value.fromAddress(token))
  )
  tokenSupportedEvent.parameters.push(
    new ethereum.EventParam(
      "tokenCount",
      ethereum.Value.fromUnsignedBigInt(tokenCount)
    )
  )

  return tokenSupportedEvent
}

export function createUserTokenAddedEvent(
  user: Address,
  token: Address,
  userTokenCount: BigInt
): UserTokenAdded {
  let userTokenAddedEvent = changetype<UserTokenAdded>(newMockEvent())

  userTokenAddedEvent.parameters = new Array()

  userTokenAddedEvent.parameters.push(
    new ethereum.EventParam("user", ethereum.Value.fromAddress(user))
  )
  userTokenAddedEvent.parameters.push(
    new ethereum.EventParam("token", ethereum.Value.fromAddress(token))
  )
  userTokenAddedEvent.parameters.push(
    new ethereum.EventParam(
      "userTokenCount",
      ethereum.Value.fromUnsignedBigInt(userTokenCount)
    )
  )

  return userTokenAddedEvent
}

export function createWithdrawEvent(
  user: Address,
  token: Address,
  amount: BigInt,
  newBalance: BigInt,
  totalDeposit: BigInt
): Withdraw {
  let withdrawEvent = changetype<Withdraw>(newMockEvent())

  withdrawEvent.parameters = new Array()

  withdrawEvent.parameters.push(
    new ethereum.EventParam("user", ethereum.Value.fromAddress(user))
  )
  withdrawEvent.parameters.push(
    new ethereum.EventParam("token", ethereum.Value.fromAddress(token))
  )
  withdrawEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )
  withdrawEvent.parameters.push(
    new ethereum.EventParam(
      "newBalance",
      ethereum.Value.fromUnsignedBigInt(newBalance)
    )
  )
  withdrawEvent.parameters.push(
    new ethereum.EventParam(
      "totalDeposit",
      ethereum.Value.fromUnsignedBigInt(totalDeposit)
    )
  )

  return withdrawEvent
}
