import { SpotOrderSide, UiSpotMarketWithToken } from '@injectivelabs/sdk-ui-ts'
import { Token } from '@injectivelabs/token-metadata'

export default function useConvertFormatter() {
  const spotStore = useSpotStore()

  const tradableSlugMap = computed(() => {
    return [
      ...spotStore.markets,
      ...spotStore.usdcConversionModalMarkets
    ].reduce((list, market) => {
      const reversedSlug = market.slug.split('-').reverse().join('-')

      return {
        ...list,
        [market.slug]: { orderType: SpotOrderSide.Sell, market },
        [reversedSlug]: { orderType: SpotOrderSide.Buy, market }
      }
    }, {} as Record<string, { orderType: SpotOrderSide; market: UiSpotMarketWithToken }>)
  })

  const availableQuoteDenoms = computed(() =>
    [...spotStore.markets, ...spotStore.usdcConversionModalMarkets].reduce(
      (tokens, market) => {
        // remove duplicate USDT keys
        const quoteTokenExistOnTokensList = tokens.some(
          (token) => token.denom === market.quoteDenom
        )

        return quoteTokenExistOnTokensList
          ? tokens
          : [market.quoteToken, ...tokens]
      },
      [] as Token[]
    )
  )

  const tradableTokensMap = computed(() => {
    return [
      ...spotStore.markets,
      ...spotStore.usdcConversionModalMarkets
    ].reduce((tokens, market) => {
      const baseTokens = tokens[market.quoteDenom]
        ? [...tokens[market.quoteDenom], market.baseToken]
        : [market.baseToken]

      const quoteToken = tokens[market.baseDenom]
        ? [...tokens[market.baseDenom], ...availableQuoteDenoms.value]
        : availableQuoteDenoms.value

      const tokenCanBeBaseOrQuote = availableQuoteDenoms.value.some(
        ({ denom }) => denom === market.baseDenom
      )

      /**
       * For markets where the base could also be the quote for another market, we only need to add the corresponding market.quoteToken
       * I.E. USDT/USDCet where USDT is base, but could also be the quote for an INJ/USDT market
       */
      return {
        ...tokens,
        [market.quoteDenom]: baseTokens,
        [market.baseDenom]: !tokenCanBeBaseOrQuote
          ? quoteToken
          : [market.quoteToken]
      }
    }, {} as Record<string, Token[]>)
  })

  function getMarketsForQuoteDenom({
    baseTokenDenom,
    quoteTokenDenom
  }: {
    baseTokenDenom: string
    quoteTokenDenom: string
  }) {
    const existingMarket = spotStore.markets.find(
      ({ baseDenom, quoteDenom }) => {
        const foundBaseTokenDenom = [quoteDenom, baseDenom].includes(
          baseTokenDenom
        )
        const foundQuoteTokenDenom = [quoteDenom, baseDenom].includes(
          quoteTokenDenom
        )

        return foundBaseTokenDenom && foundQuoteTokenDenom
      }
    )

    if (existingMarket) {
      return existingMarket
    }

    const defaultMarket = spotStore.markets.find(({ quoteDenom }) =>
      [baseTokenDenom, quoteTokenDenom].includes(quoteDenom)
    )

    return defaultMarket || spotStore.markets[0]
  }

  return {
    tradableSlugMap,
    tradableTokensMap,
    getMarketsForQuoteDenom
  }
}
