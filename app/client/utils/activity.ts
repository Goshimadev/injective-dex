import { TradeExecutionType } from '@injectivelabs/ts-types'
import { ConditionalOrderSide, ConditionalOrderType, TradeTypes } from '@/types'

export function tradeTypesToTradeExecutionTypes(
  type: TradeTypes | undefined
): TradeExecutionType[] | undefined {
  if (type === TradeTypes.Market) {
    return [TradeExecutionType.Market]
  }

  if (type === TradeTypes.Limit) {
    return [
      TradeExecutionType.LimitFill,
      TradeExecutionType.LimitMatchRestingOrder,
      TradeExecutionType.LimitMatchNewOrder
    ]
  }

  return undefined
}

export function orderTypeToOrderTypes(orderType?: string) {
  if (orderType === undefined) {
    return [ConditionalOrderSide.Buy, ConditionalOrderSide.Sell]
  }

  if (orderType === ConditionalOrderType.TakeProfit) {
    return [ConditionalOrderSide.TakeBuy, ConditionalOrderSide.TakeSell]
  }

  return [ConditionalOrderSide.StopBuy, ConditionalOrderSide.StopSell]
}
