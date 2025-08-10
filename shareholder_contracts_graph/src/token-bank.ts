import {
  Deposit as DepositEvent,
  DepositWithPermit2 as DepositWithPermit2Event,
  TokenSupported as TokenSupportedEvent,
  UserTokenAdded as UserTokenAddedEvent,
  Withdraw as WithdrawEvent
} from "../generated/TokenBank/TokenBank"
import {
  Deposit,
  DepositWithPermit2,
  TokenSupported,
  UserTokenAdded,
  Withdraw
} from "../generated/schema"

export function handleDeposit(event: DepositEvent): void {
  let entity = new Deposit(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.user = event.params.user
  entity.token = event.params.token
  entity.amount = event.params.amount
  entity.newBalance = event.params.newBalance
  entity.totalDeposit = event.params.totalDeposit

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleDepositWithPermit2(event: DepositWithPermit2Event): void {
  let entity = new DepositWithPermit2(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.user = event.params.user
  entity.token = event.params.token
  entity.amount = event.params.amount
  entity.nonce = event.params.nonce
  entity.deadline = event.params.deadline
  entity.newBalance = event.params.newBalance
  entity.totalDeposit = event.params.totalDeposit

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleTokenSupported(event: TokenSupportedEvent): void {
  let entity = new TokenSupported(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.token = event.params.token
  entity.tokenCount = event.params.tokenCount

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleUserTokenAdded(event: UserTokenAddedEvent): void {
  let entity = new UserTokenAdded(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.user = event.params.user
  entity.token = event.params.token
  entity.userTokenCount = event.params.userTokenCount

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleWithdraw(event: WithdrawEvent): void {
  let entity = new Withdraw(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.user = event.params.user
  entity.token = event.params.token
  entity.amount = event.params.amount
  entity.newBalance = event.params.newBalance
  entity.totalDeposit = event.params.totalDeposit

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}
