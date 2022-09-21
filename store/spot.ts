import { actionTree, getterTree } from 'typed-vuex'
import {
  BigNumberInBase,
  spotPriceToChainPriceToFixed,
  spotQuantityToChainQuantityToFixed
} from '@injectivelabs/utils'
import {
  StreamOperation,
  TradeExecutionSide,
  TradeExecutionType
} from '@injectivelabs/ts-types'
import {
  MsgBatchCancelSpotOrders,
  MsgCancelSpotOrder,
  MsgCreateSpotLimitOrder,
  MsgCreateSpotMarketOrder,
  SpotOrderSide,
  SpotOrderState
} from '@injectivelabs/sdk-ts'
import {
  Change,
  SpotMetrics,
  spotOrderTypeToGrpcOrderType,
  UiSpotLimitOrder,
  UiSpotMarketSummary,
  UiSpotMarketWithToken,
  UiSpotOrderbook,
  UiSpotOrderHistory,
  UiSpotTrade,
  UiSpotTransformer,
  zeroSpotMarketSummary,
  ZERO_IN_BASE
} from '@injectivelabs/sdk-ui-ts'
import { GeneralException } from '@injectivelabs/exceptions'
import {
  streamOrderbook,
  streamTrades,
  streamSubaccountOrders,
  streamSubaccountOrderHistory,
  streamSubaccountTrades
} from '~/app/client/streams/spot'
import {
  FEE_RECIPIENT,
  ORDERBOOK_STREAMING_ENABLED
} from '~/app/utils/constants'
import {
  indexerRestSpotChronosApi,
  indexerSpotApi,
  msgBroadcastClient,
  tokenPrice,
  tokenService
} from '~/app/Services'
import { spot as allowedSpotMarkets } from '~/routes.config'
import { ActivityFetchOptions } from '~/types'

const initialStateFactory = () => ({
  markets: [] as UiSpotMarketWithToken[],
  marketsSummary: [] as UiSpotMarketSummary[],
  market: undefined as UiSpotMarketWithToken | undefined,
  marketSummary: undefined as UiSpotMarketSummary | undefined,
  orderbook: undefined as UiSpotOrderbook | undefined,
  trades: [] as UiSpotTrade[],
  subaccountTrades: [] as UiSpotTrade[],
  subaccountTradesPagination: {
    endTime: 0 as number,
    total: 0 as number
  },
  subaccountOrders: [] as UiSpotLimitOrder[],
  subaccountOrdersPagination: {
    total: 0 as number,
    endTime: 0 as number
  },
  subaccountOrderHistory: [] as UiSpotOrderHistory[],
  subaccountOrderHistoryPagination: {
    total: 0 as number,
    endTime: 0 as number
  },
  subaccountConditionalOrders: [] as UiSpotOrderHistory[],
  subaccountConditionalOrdersPagination: {
    total: 0 as number,
    endTime: 0 as number
  }
})

const initialState = initialStateFactory()

export const state = () => ({
  markets: initialState.markets as UiSpotMarketWithToken[],
  marketsSummary: initialState.marketsSummary as UiSpotMarketSummary[],
  market: initialState.market as UiSpotMarketWithToken | undefined,
  marketSummary: initialState.marketSummary as UiSpotMarketSummary | undefined,
  trades: initialState.trades as UiSpotTrade[],
  subaccountTrades: initialState.subaccountTrades as UiSpotTrade[],
  subaccountTradesPagination: initialState.subaccountTradesPagination,
  subaccountOrders: initialState.subaccountOrders as UiSpotLimitOrder[],
  subaccountOrdersPagination: initialState.subaccountOrdersPagination,
  subaccountOrderHistory:
    initialState.subaccountOrderHistory as UiSpotOrderHistory[],
  subaccountOrderHistoryPagination:
    initialState.subaccountOrderHistoryPagination,
  subaccountConditionalOrders:
    initialState.subaccountConditionalOrders as UiSpotOrderHistory[],
  subaccountConditionalOrdersPagination:
    initialState.subaccountConditionalOrdersPagination,
  orderbook: initialState.orderbook as UiSpotOrderbook | undefined
})

export type SpotStoreState = ReturnType<typeof state>

export const getters = getterTree(state, {
  marketSelected: (state) => {
    return !!state.market
  },

  lastTradedPrice: (state) => {
    if (!state.market) {
      return ZERO_IN_BASE
    }

    if (state.trades.length === 0) {
      return ZERO_IN_BASE
    }

    const [trade] = state.trades

    return new BigNumberInBase(
      new BigNumberInBase(trade.price).toWei(
        state.market.baseToken.decimals - state.market.quoteToken.decimals
      )
    )
  },

  lastTradedPriceChange: (state): Change => {
    if (!state.market) {
      return Change.NoChange
    }

    if (state.trades.length === 0) {
      return Change.NoChange
    }

    const [trade] = state.trades
    const [secondLastTrade] = state.trades.filter(
      (t) => !new BigNumberInBase(t.price).eq(trade.price)
    )

    if (!secondLastTrade) {
      return Change.NoChange
    }

    const lastPrice = new BigNumberInBase(trade.price)
    const secondLastPrice = new BigNumberInBase(secondLastTrade.price)

    return lastPrice.gte(secondLastPrice) ? Change.Increase : Change.Decrease
  },

  activeMarketIds: (state) => state.markets.map((m) => m.marketId)
})

export const mutations = {
  setMarket(state: SpotStoreState, market: UiSpotMarketWithToken) {
    state.market = market
  },

  setMarketSummary(state: SpotStoreState, marketSummary: UiSpotMarketSummary) {
    state.marketSummary = marketSummary
  },

  resetMarket(state: SpotStoreState) {
    const initialState = initialStateFactory()

    state.market = initialState.market
    state.marketSummary = initialState.marketSummary
    state.orderbook = initialState.orderbook
    state.trades = initialState.trades
    state.subaccountOrders = initialState.subaccountOrders
    state.subaccountTrades = initialState.subaccountTrades
  },

  setMarkets(state: SpotStoreState, markets: UiSpotMarketWithToken[]) {
    state.markets = markets
  },

  setMarketsSummary(
    state: SpotStoreState,
    marketsSummary: UiSpotMarketSummary[]
  ) {
    state.marketsSummary = marketsSummary
  },

  setTrades(state: SpotStoreState, trades: UiSpotTrade[]) {
    state.trades = trades
  },

  pushTrade(state: SpotStoreState, trade: UiSpotTrade) {
    state.trades = [trade, ...state.trades]
  },

  setSubaccountTrades(state: SpotStoreState, subaccountTrades: UiSpotTrade[]) {
    state.subaccountTrades = subaccountTrades
  },

  setSubaccountTradesEndTime(state: SpotStoreState, endTime: number) {
    state.subaccountTradesPagination.endTime = endTime
  },

  setSubaccountTradesTotal(state: SpotStoreState, total: number) {
    state.subaccountTradesPagination.total = total
  },

  setSubaccountOrdersEndTime(state: SpotStoreState, endTime: number) {
    state.subaccountOrdersPagination.endTime = endTime
  },

  setSubaccountOrdersTotal(state: SpotStoreState, total: number) {
    state.subaccountOrdersPagination.total = total
  },

  setSubaccountOrderHistory(
    state: SpotStoreState,
    orderHistory: UiSpotOrderHistory[]
  ) {
    state.subaccountOrderHistory = orderHistory
  },

  setSubaccountOrderHistoryEndTime(state: SpotStoreState, endTime: number) {
    state.subaccountOrderHistoryPagination.endTime = endTime
  },

  setSubaccountOrderHistoryTotal(state: SpotStoreState, total: number) {
    state.subaccountOrderHistoryPagination.total = total
  },

  setSubaccountConditionalOrders(
    state: SpotStoreState,
    conditionalOrders: UiSpotOrderHistory[]
  ) {
    state.subaccountConditionalOrders = conditionalOrders
  },

  setSubaccountConditionalOrdersEndTime(
    state: SpotStoreState,
    endTime: number
  ) {
    state.subaccountConditionalOrdersPagination.endTime = endTime
  },

  setSubaccountConditionalOrdersTotal(state: SpotStoreState, total: number) {
    state.subaccountConditionalOrdersPagination.total = total
  },

  setSubaccountOrders(
    state: SpotStoreState,
    subaccountOrders: UiSpotLimitOrder[]
  ) {
    state.subaccountOrders = subaccountOrders
  },

  pushSubaccountOrder(
    state: SpotStoreState,
    subaccountOrder: UiSpotLimitOrder
  ) {
    state.subaccountOrders = [subaccountOrder, ...state.subaccountOrders]
  },

  updateSubaccountOrder(
    state: SpotStoreState,
    subaccountOrder: UiSpotLimitOrder
  ) {
    if (subaccountOrder.orderHash) {
      state.subaccountOrders = state.subaccountOrders.map((order) => {
        return order.orderHash === subaccountOrder.orderHash
          ? subaccountOrder
          : order
      })
    }
  },

  pushOrUpdateSubaccountOrder(
    state: SpotStoreState,
    subaccountOrder: UiSpotLimitOrder
  ) {
    const subaccountOrders = [...state.subaccountOrders].filter(
      (order) => order.orderHash !== subaccountOrder.orderHash
    )

    state.subaccountOrders = [subaccountOrder, ...subaccountOrders]
  },

  pushOrUpdateSubaccountOrderHistory(
    state: SpotStoreState,
    subaccountOrder: UiSpotOrderHistory
  ) {
    const subaccountOrderHistory = [...state.subaccountOrderHistory].filter(
      (order) => order.orderHash !== subaccountOrder.orderHash
    )

    state.subaccountOrderHistory = [subaccountOrder, ...subaccountOrderHistory]
  },

  updateSubaccountOrderHistory(
    state: SpotStoreState,
    subaccountOrder: UiSpotOrderHistory
  ) {
    if (subaccountOrder.orderHash) {
      state.subaccountOrderHistory = state.subaccountOrderHistory.map(
        (order) => {
          return order.orderHash === subaccountOrder.orderHash
            ? subaccountOrder
            : order
        }
      )
    }
  },

  deleteSubaccountOrder(
    state: SpotStoreState,
    subaccountOrder: UiSpotLimitOrder
  ) {
    const subaccountOrders = [...state.subaccountOrders].filter(
      (order) => order.orderHash !== subaccountOrder.orderHash
    )

    state.subaccountOrders = subaccountOrders
  },

  pushSubaccountTrade(state: SpotStoreState, subaccountTrade: UiSpotTrade) {
    state.subaccountTrades = [subaccountTrade, ...state.subaccountTrades]
  },

  updateSubaccountTrade(state: SpotStoreState, subaccountTrade: UiSpotTrade) {
    if (subaccountTrade.orderHash) {
      state.subaccountTrades = state.subaccountTrades.map((order) => {
        return order.orderHash === subaccountTrade.orderHash
          ? subaccountTrade
          : order
      })
    }
  },

  deleteSubaccountTrade(state: SpotStoreState, subaccountTrade: UiSpotTrade) {
    const subaccountTrades = [...state.subaccountTrades].filter(
      (order) => order.orderHash !== subaccountTrade.orderHash
    )

    state.subaccountTrades = subaccountTrades
  },

  setOrderbook(state: SpotStoreState, orderbook: UiSpotOrderbook) {
    state.orderbook = orderbook
  },

  resetSubaccount(state: SpotStoreState) {
    const initialState = initialStateFactory()

    state.subaccountTrades = initialState.subaccountTrades
    state.subaccountOrders = initialState.subaccountOrders
  }
}

export const actions = actionTree(
  { state, mutations },
  {
    async reset({ commit }) {
      commit('resetMarket')
      await this.app.$accessor.app.cancelAllStreams()
    },

    async init({ commit }) {
      const markets = await indexerSpotApi.fetchMarkets()
      const marketsWithToken = await tokenService.getSpotMarketsWithToken(
        markets
      )
      const uiMarkets =
        UiSpotTransformer.spotMarketsToUiSpotMarkets(marketsWithToken)

      // Only include markets that we pre-defined to generate static routes for
      const uiMarketsWithToken = uiMarkets
        .filter((market) => {
          return allowedSpotMarkets.includes(market.slug)
        })
        .sort((a, b) => {
          return (
            allowedSpotMarkets.indexOf(a.slug) -
            allowedSpotMarkets.indexOf(b.slug)
          )
        })

      commit('setMarkets', uiMarketsWithToken)

      const marketsSummary =
        await indexerRestSpotChronosApi.fetchMarketsSummary()
      const marketSummaryNotExists =
        !marketsSummary || (marketsSummary && marketsSummary.length === 0)
      const actualMarketsSummary = marketSummaryNotExists
        ? markets.map((market) => zeroSpotMarketSummary(market.marketId))
        : marketsSummary

      commit('setMarketsSummary', actualMarketsSummary as UiSpotMarketSummary[])
    },

    async initMarket({ commit, state }, marketSlug: string) {
      const { markets } = state

      if (!markets.length) {
        await this.app.$accessor.spot.init()
      }

      const { markets: newMarkets } = state
      const market = newMarkets.find(
        (market) => market.slug.toLowerCase() === marketSlug.toLowerCase()
      )

      if (!market) {
        throw new GeneralException(
          new Error('Market not found. Please refresh the page.')
        )
      }

      const summary = await indexerRestSpotChronosApi.fetchMarketSummary(
        market.marketId
      )

      commit('setMarket', market)
      commit('setMarketSummary', { marketId: market.marketId, ...summary })

      if (ORDERBOOK_STREAMING_ENABLED) {
        await this.app.$accessor.spot.streamOrderbook()
      }

      await this.app.$accessor.exchange.fetchFeeDiscountAccountInfo()
      await this.app.$accessor.exchange.fetchTradingRewardsCampaign()
    },

    async initMarketStreams({ state }) {
      const { market } = state

      if (!market) {
        return
      }

      await this.app.$accessor.spot.streamTrades()
      await this.app.$accessor.spot.streamSubaccountTrades()
      await this.app.$accessor.spot.streamSubaccountOrders()
      await this.app.$accessor.spot.streamSubaccountOrderHistory()
      await this.app.$accessor.account.streamSubaccountBalances()
    },

    async pollOrderbook({ commit, state }) {
      const { market } = state

      if (!market) {
        return
      }

      commit(
        'setOrderbook',
        await indexerSpotApi.fetchOrderbook(market.marketId)
      )
    },

    streamOrderbook({ commit, state }) {
      const { market } = state

      if (!market) {
        return
      }

      streamOrderbook({
        marketId: market.marketId,
        callback: ({ orderbook }) => {
          if (!orderbook) {
            return
          }

          commit('setOrderbook', orderbook)
        }
      })
    },

    streamTrades({ commit, state }) {
      const { market } = state

      if (!market) {
        return
      }

      streamTrades({
        marketId: market.marketId,
        callback: ({ trade, operation }) => {
          if (!trade) {
            return
          }

          switch (operation) {
            case StreamOperation.Insert:
              commit('pushTrade', trade)
          }
        }
      })
    },

    streamSubaccountOrders({ commit }) {
      const { subaccount } = this.app.$accessor.account
      const { isUserWalletConnected } = this.app.$accessor.wallet

      if (!isUserWalletConnected || !subaccount) {
        return
      }

      streamSubaccountOrders({
        subaccountId: subaccount.subaccountId,
        callback: ({ order }) => {
          if (!order) {
            return
          }

          switch (order.state) {
            case SpotOrderState.Booked:
            case SpotOrderState.Unfilled:
            case SpotOrderState.PartialFilled: {
              commit('pushOrUpdateSubaccountOrder', order)
              break
            }
            case SpotOrderState.Canceled:
            case SpotOrderState.Filled: {
              commit('deleteSubaccountOrder', order)
              break
            }
          }
        }
      })
    },

    streamSubaccountOrderHistory({ commit }) {
      const { subaccount } = this.app.$accessor.account
      const { isUserWalletConnected } = this.app.$accessor.wallet

      if (!isUserWalletConnected || !subaccount) {
        return
      }

      streamSubaccountOrderHistory({
        subaccountId: subaccount.subaccountId,
        callback: ({ order }) => {
          if (!order) {
            return
          }

          switch (order.state) {
            case SpotOrderState.Booked:
            case SpotOrderState.Filled:
            case SpotOrderState.Unfilled:
            case SpotOrderState.PartialFilled: {
              commit('pushOrUpdateSubaccountOrderHistory', order)
              break
            }
            case SpotOrderState.Canceled: {
              commit('updateSubaccountOrderHistory', order)
              break
            }
          }
        }
      })
    },

    streamSubaccountTrades({ state, commit }) {
      const { market } = state
      const { subaccount } = this.app.$accessor.account
      const { isUserWalletConnected } = this.app.$accessor.wallet

      if (!market) {
        return
      }

      if (!isUserWalletConnected || !subaccount) {
        return
      }

      streamSubaccountTrades({
        marketId: market.marketId,
        subaccountId: subaccount.subaccountId,
        callback: ({ trade, operation }) => {
          if (!trade) {
            return
          }

          switch (operation) {
            case StreamOperation.Insert:
              commit('pushSubaccountTrade', trade)
              break
            case StreamOperation.Delete:
              commit('deleteSubaccountTrade', trade)
              break
            case StreamOperation.Update:
              commit('updateSubaccountTrade', trade)
              break
          }
        }
      })
    },

    async fetchSubaccountOrders(
      { state, commit },
      activityFetchOptions: ActivityFetchOptions | undefined
    ) {
      const { subaccount } = this.app.$accessor.account
      const { isUserWalletConnected } = this.app.$accessor.wallet

      if (!isUserWalletConnected || !subaccount) {
        return
      }

      const paginationOptions = activityFetchOptions?.pagination
      const filters = activityFetchOptions?.filters

      if (
        state.subaccountOrders.length > 0 &&
        state.subaccountOrdersPagination.endTime === 0
      ) {
        commit(
          'setSubaccountOrdersEndTime',
          state.subaccountOrders[0].createdAt
        )
      }

      const { orders, pagination } = await indexerSpotApi.fetchOrders({
        marketId: filters?.marketId,
        marketIds: filters?.marketIds,
        subaccountId: subaccount.subaccountId,
        orderSide: filters?.orderSide as SpotOrderSide,
        // isConditional: false,
        pagination: {
          skip: paginationOptions ? paginationOptions.skip : 0,
          limit: paginationOptions ? paginationOptions.limit : 0,
          endTime: state.subaccountOrdersPagination.endTime
        }
      })

      commit('setSubaccountOrdersTotal', pagination.total)
      commit('setSubaccountOrders', orders)
    },

    async fetchSubaccountOrderHistory(
      { state, commit },
      activityFetchOptions: ActivityFetchOptions | undefined
    ) {
      const { subaccount } = this.app.$accessor.account
      const { isUserWalletConnected } = this.app.$accessor.wallet

      if (!isUserWalletConnected || !subaccount) {
        return
      }

      const paginationOptions = activityFetchOptions?.pagination
      const filters = activityFetchOptions?.filters

      if (
        state.subaccountOrderHistory.length > 0 &&
        state.subaccountOrderHistoryPagination.endTime === 0
      ) {
        commit(
          'setSubaccountOrderHistoryEndTime',
          state.subaccountOrderHistory[0].createdAt
        )
      }

      const { orderHistory, pagination } =
        await indexerSpotApi.fetchOrderHistory({
          marketId: filters?.marketId,
          subaccountId: subaccount.subaccountId,
          orderTypes: filters?.orderTypes as unknown as SpotOrderSide[],
          executionTypes: filters?.executionTypes as TradeExecutionType[],
          direction: filters?.direction,
          isConditional: filters?.isConditional,
          pagination: {
            skip: paginationOptions ? paginationOptions.skip : 0,
            limit: paginationOptions ? paginationOptions.limit : 0,
            endTime: state.subaccountOrderHistoryPagination.endTime
          }
        })

      commit('setSubaccountOrderHistoryTotal', pagination.total)
      commit('setSubaccountOrderHistory', orderHistory)
    },

    async fetchSubaccountConditionalOrders(
      { commit, state },
      activityFetchOptions: ActivityFetchOptions | undefined
    ) {
      const { subaccount } = this.app.$accessor.account
      const { isUserWalletConnected } = this.app.$accessor.wallet

      if (!isUserWalletConnected || !subaccount) {
        return
      }

      const paginationOptions = activityFetchOptions?.pagination
      const filters = activityFetchOptions?.filters

      if (
        state.subaccountConditionalOrders.length > 0 &&
        state.subaccountConditionalOrdersPagination.endTime === 0
      ) {
        commit(
          'setSubaccountConditionalOrdersEndTime',
          state.subaccountConditionalOrders[0].createdAt
        )
      }

      const { orderHistory, pagination } =
        await indexerSpotApi.fetchOrderHistory({
          marketId: filters?.marketId,
          subaccountId: subaccount.subaccountId,
          orderTypes: filters?.orderTypes as unknown as SpotOrderSide[],
          executionTypes: filters?.executionTypes as TradeExecutionType[],
          direction: filters?.direction,
          isConditional: true,
          pagination: {
            skip: paginationOptions ? paginationOptions.skip : 0,
            limit: paginationOptions ? paginationOptions.limit : 0,
            endTime: state.subaccountConditionalOrdersPagination.endTime
          }
        })

      commit('setSubaccountConditionalOrdersTotal', pagination.total)
      commit('setSubaccountConditionalOrders', orderHistory)
    },

    async fetchOrderbook({ state, commit }) {
      const { market } = state

      if (!market) {
        return
      }

      commit(
        'setOrderbook',
        await indexerSpotApi.fetchOrderbook(market.marketId)
      )
    },

    async fetchTrades({ state, commit }, executionSide?: TradeExecutionSide) {
      const { market } = state

      if (!market) {
        return
      }

      const { trades } = await indexerSpotApi.fetchTrades({
        marketId: market.marketId,
        executionSide
      })

      commit('setTrades', trades)
    },

    async fetchSubaccountTrades(
      { state, commit },
      activityFetchOptions: ActivityFetchOptions | undefined
    ) {
      const { subaccount } = this.app.$accessor.account
      const { isUserWalletConnected } = this.app.$accessor.wallet

      if (!isUserWalletConnected || !subaccount) {
        return
      }

      if (
        state.subaccountTrades.length > 0 &&
        state.subaccountTradesPagination.endTime === 0
      ) {
        commit(
          'setSubaccountTradesEndTime',
          state.subaccountTrades[0].timestamp
        )
      }

      const paginationOptions = activityFetchOptions?.pagination
      const filters = activityFetchOptions?.filters

      const { trades, pagination } = await indexerSpotApi.fetchTrades({
        marketId: filters?.marketId,
        marketIds: filters?.marketIds,
        subaccountId: subaccount.subaccountId,
        executionTypes: filters?.types,
        direction: filters?.direction,
        pagination: {
          skip: paginationOptions ? paginationOptions.skip : 0,
          limit: paginationOptions ? paginationOptions.limit : 0,
          endTime: state.subaccountTradesPagination.endTime
        }
      })

      commit('setSubaccountTradesTotal', pagination.total)
      commit('setSubaccountTrades', trades)
    },

    async fetchMarketsSummary({ state, commit }) {
      const { marketsSummary, markets, market } = state

      if (marketsSummary.length === 0) {
        return
      }

      const updatedMarketsSummary =
        await indexerRestSpotChronosApi.fetchMarketsSummary()
      const combinedMarketsSummary =
        UiSpotTransformer.spotMarketsSummaryComparisons(
          updatedMarketsSummary,
          state.marketsSummary
        )

      if (
        !combinedMarketsSummary ||
        (combinedMarketsSummary && combinedMarketsSummary.length === 0)
      ) {
        commit(
          'setMarketsSummary',
          markets.map((market) => zeroSpotMarketSummary(market.marketId))
        )
      } else {
        if (market) {
          const updatedMarketSummary = combinedMarketsSummary.find(
            (m) => m.marketId === market.marketId
          )

          if (updatedMarketSummary) {
            commit('setMarketSummary', updatedMarketSummary)
          }
        }

        commit('setMarketsSummary', combinedMarketsSummary)
      }
    },

    async cancelOrder(_, order: UiSpotLimitOrder | UiSpotOrderHistory) {
      const { subaccount } = this.app.$accessor.account
      const { address, injectiveAddress, isUserWalletConnected } =
        this.app.$accessor.wallet

      if (!isUserWalletConnected || !subaccount) {
        return
      }

      await this.app.$accessor.app.queue()
      await this.app.$accessor.wallet.validate()

      const message = MsgCancelSpotOrder.fromJSON({
        injectiveAddress,
        marketId: order.marketId,
        subaccountId: order.subaccountId,
        orderHash: order.orderHash
      })

      await msgBroadcastClient.broadcast({
        address,
        msgs: message,
        bucket: SpotMetrics.BatchCancelLimitOrders
      })
    },

    async batchCancelOrder(_, orders: UiSpotLimitOrder[]) {
      const { subaccount } = this.app.$accessor.account
      const { address, injectiveAddress, isUserWalletConnected } =
        this.app.$accessor.wallet

      if (!isUserWalletConnected || !subaccount) {
        return
      }

      await this.app.$accessor.app.queue()
      await this.app.$accessor.wallet.validate()

      const messages = orders.map((order) =>
        MsgBatchCancelSpotOrders.fromJSON({
          injectiveAddress,
          orders: [
            {
              marketId: order.marketId,
              subaccountId: order.subaccountId,
              orderHash: order.orderHash
            }
          ]
        })
      )

      await msgBroadcastClient.broadcast({
        address,
        msgs: messages,
        bucket: SpotMetrics.BatchCancelLimitOrders
      })
    },

    async submitLimitOrder(
      { state },
      {
        price,
        quantity,
        orderType
      }: {
        price: BigNumberInBase
        quantity: BigNumberInBase
        orderType: SpotOrderSide
      }
    ) {
      const { market } = state
      const { subaccount } = this.app.$accessor.account
      const { address, injectiveAddress, isUserWalletConnected } =
        this.app.$accessor.wallet
      const { feeRecipient: referralFeeRecipient } = this.app.$accessor.referral

      if (!isUserWalletConnected || !subaccount || !market) {
        return
      }

      await this.app.$accessor.app.queue()
      await this.app.$accessor.wallet.validate()

      const message = MsgCreateSpotLimitOrder.fromJSON({
        injectiveAddress,
        orderType: spotOrderTypeToGrpcOrderType(orderType),
        price: spotPriceToChainPriceToFixed({
          value: price,
          baseDecimals: market.baseToken.decimals,
          quoteDecimals: market.quoteToken.decimals
        }),
        quantity: spotQuantityToChainQuantityToFixed({
          value: quantity,
          baseDecimals: market.baseToken.decimals
        }),
        marketId: market.marketId,
        feeRecipient: referralFeeRecipient || FEE_RECIPIENT,
        subaccountId: subaccount.subaccountId
      })

      await msgBroadcastClient.broadcast({
        address,
        msgs: message,
        bucket: SpotMetrics.CreateLimitOrder
      })
    },

    async submitStopLimitOrder(
      { state },
      {
        price,
        triggerPrice,
        quantity,
        orderType
      }: {
        price: BigNumberInBase
        triggerPrice: BigNumberInBase
        quantity: BigNumberInBase
        orderType: SpotOrderSide
      }
    ) {
      const { market } = state
      const { subaccount } = this.app.$accessor.account
      const { address, injectiveAddress, isUserWalletConnected } =
        this.app.$accessor.wallet
      const { feeRecipient: referralFeeRecipient } = this.app.$accessor.referral

      if (!isUserWalletConnected || !subaccount || !market) {
        return
      }

      await this.app.$accessor.app.queue()
      await this.app.$accessor.wallet.validate()

      const message = MsgCreateSpotLimitOrder.fromJSON({
        injectiveAddress,
        orderType: spotOrderTypeToGrpcOrderType(orderType),
        price: spotPriceToChainPriceToFixed({
          value: price,
          baseDecimals: market.baseToken.decimals,
          quoteDecimals: market.quoteToken.decimals
        }),
        triggerPrice: spotPriceToChainPriceToFixed({
          value: triggerPrice,
          baseDecimals: market.baseToken.decimals,
          quoteDecimals: market.quoteToken.decimals
        }),
        quantity: spotQuantityToChainQuantityToFixed({
          value: quantity,
          baseDecimals: market.baseToken.decimals
        }),
        marketId: market.marketId,
        feeRecipient: referralFeeRecipient || FEE_RECIPIENT,
        subaccountId: subaccount.subaccountId
      })

      await msgBroadcastClient.broadcast({
        address,
        msgs: message,
        bucket: SpotMetrics.CreateLimitOrder
      })
    },

    async submitMarketOrder(
      { state },
      {
        quantity,
        price,
        orderType
      }: {
        price: BigNumberInBase
        quantity: BigNumberInBase
        orderType: SpotOrderSide
      }
    ) {
      const { market } = state
      const { subaccount } = this.app.$accessor.account
      const { address, injectiveAddress, isUserWalletConnected } =
        this.app.$accessor.wallet
      const { feeRecipient: referralFeeRecipient } = this.app.$accessor.referral

      if (!isUserWalletConnected || !subaccount || !market) {
        return
      }

      await this.app.$accessor.app.queue()
      await this.app.$accessor.wallet.validate()

      const message = MsgCreateSpotMarketOrder.fromJSON({
        injectiveAddress,
        orderType: spotOrderTypeToGrpcOrderType(orderType),
        price: spotPriceToChainPriceToFixed({
          value: price,
          baseDecimals: market.baseToken.decimals,
          quoteDecimals: market.quoteToken.decimals
        }),
        quantity: spotQuantityToChainQuantityToFixed({
          value: quantity,
          baseDecimals: market.baseToken.decimals
        }),
        marketId: market.marketId,
        feeRecipient: referralFeeRecipient || FEE_RECIPIENT,
        subaccountId: subaccount.subaccountId
      })

      await msgBroadcastClient.broadcast({
        address,
        msgs: message,
        bucket: SpotMetrics.CreateMarketOrder
      })
    },

    async submitStopMarketOrder(
      { state },
      {
        quantity,
        price,
        triggerPrice,
        orderType
      }: {
        price: BigNumberInBase
        triggerPrice: BigNumberInBase
        quantity: BigNumberInBase
        orderType: SpotOrderSide
      }
    ) {
      const { market } = state
      const { subaccount } = this.app.$accessor.account
      const { address, injectiveAddress, isUserWalletConnected } =
        this.app.$accessor.wallet
      const { feeRecipient: referralFeeRecipient } = this.app.$accessor.referral

      if (!isUserWalletConnected || !subaccount || !market) {
        return
      }

      await this.app.$accessor.app.queue()
      await this.app.$accessor.wallet.validate()

      const message = MsgCreateSpotMarketOrder.fromJSON({
        injectiveAddress,
        orderType: spotOrderTypeToGrpcOrderType(orderType),
        price: spotPriceToChainPriceToFixed({
          value: price,
          baseDecimals: market.baseToken.decimals,
          quoteDecimals: market.quoteToken.decimals
        }),
        triggerPrice: spotPriceToChainPriceToFixed({
          value: triggerPrice,
          baseDecimals: market.baseToken.decimals,
          quoteDecimals: market.quoteToken.decimals
        }),
        quantity: spotQuantityToChainQuantityToFixed({
          value: quantity,
          baseDecimals: market.baseToken.decimals
        }),
        marketId: market.marketId,
        feeRecipient: referralFeeRecipient || FEE_RECIPIENT,
        subaccountId: subaccount.subaccountId
      })

      await msgBroadcastClient.broadcast({
        address,
        msgs: message,
        bucket: SpotMetrics.CreateMarketOrder
      })
    },

    async fetchUsdPrice(_, coinGeckoId: string) {
      return await tokenPrice.fetchUsdTokenPrice(coinGeckoId)
    }
  }
)
