import {
  SubaccountBalanceWithToken,
  UiDerivativeMarketSummary,
  UiDerivativeMarketWithToken,
  UiSpotMarketSummary,
  UiSpotMarketWithToken
} from '@injectivelabs/sdk-ui-ts'
import { TradeExecutionType, TradeDirection } from '@injectivelabs/ts-types'
import { BigNumberInBase } from '@injectivelabs/utils'
import {
  PaginationOption,
  SpotOrderSide,
  DerivativeOrderSide
} from '@injectivelabs/sdk-ts'
import { ConditionalOrderSide } from '~/components/partials/activity/common/types'

export interface DOMEvent<T extends EventTarget> extends Event {
  target: T
  keyCode?: number
  key?: string
  view?: {
    getSelection: Function
  }
}

export interface Constructable<T> {
  new (...args: any): T
}

export interface GeoLocation {
  continent: string
  country: string
}

export interface SubaccountBalanceWithTokenMarginAndPnlTotalBalanceInUsd
  extends Omit<SubaccountBalanceWithToken, 'totalBalance'> {
  inOrderBalance: BigNumberInBase
  margin: BigNumberInBase
  pnlInUsd: BigNumberInBase
  totalBalance: BigNumberInBase
  totalBalanceInUsd: BigNumberInBase
}

export interface UiMarketAndSummary {
  market: UiDerivativeMarketWithToken | UiSpotMarketWithToken
  summary: UiDerivativeMarketSummary | UiSpotMarketSummary
}

export interface UiMarketAndSummaryWithVolumeInUsd extends UiMarketAndSummary {
  volumeInUsd: BigNumberInBase
}

export interface MarketRoute {
  name: string
  params?: {
    marketId: string
    market?: string
    derivative?: string
    futures?: string
    perpetual?: string
    binaryOption?: string
    spot?: string
  }
}

export interface DefaultMarketRoute {
  to: {
    name: string
    params?: {
      market?: string
      derivative?: string
      futures?: string
      perpetual?: string
      binaryOption?: string
      spot?: string
    }
  }
}

export interface TradeConfirmationModalData {
  tradingType: TradeExecutionType
  orderType: SpotOrderSide | DerivativeOrderSide
  triggerPrice: BigNumberInBase
  triggerPriceSymbol: string
  amount: BigNumberInBase
  amountSymbol: string
  price?: BigNumberInBase
  priceSymbol?: string
  isReduceOnly?: boolean
}

export declare type TokenUsdPriceMap = Record<string, number>

export interface FilterOptions {
  marketId?: string
  marketIds?: string[]
  direction?: TradeDirection
  orderSide?: SpotOrderSide | DerivativeOrderSide
  orderType?: SpotOrderSide | DerivativeOrderSide
  orderTypes?: ConditionalOrderSide[]
  executionTypes?: TradeExecutionType[]
  types?: TradeExecutionType[]
  denom?: string
  isConditional?: boolean
}

export interface ActivityFetchOptions {
  pagination?: PaginationOption
  filters?: FilterOptions
}

export interface OrderTypeFilter {
  executionType?: string
  orderType?: string
}

export * from './enums'
export * from './env'
export * from './errors'
export * from './states'
