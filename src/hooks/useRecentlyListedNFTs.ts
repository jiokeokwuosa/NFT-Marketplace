import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

/** Fields for a listed item from the indexer */
export interface NFTItem {
    rindexerId: string
    seller: string
    nftAddress: string
    price: string
    tokenId: string
    contractAddress: string
    txHash: string
    blockNumber: string
}

/** Minimal fields for bought/cancelled items (filtering) */
export interface BoughtCancelled {
    nftAddress: string
    tokenId: string
}

/** Shape of GraphQL `data` for the marketplace query */
export interface MarketplaceGraphQLData {
    allItemListeds: {
        nodes: NFTItem[]
    }
    allItemCanceleds: {
        nodes: BoughtCancelled[]
    }
    allItemBoughts: {
        nodes: BoughtCancelled[]
    }
}

/** Row passed to listing UI (e.g. NFTBox) */
export interface RecentlyListedNft {
    tokenId: string
    contractAddress: string
    price: string
    seller: string
}

const GET_RECENT_NFTS = `
  query GetMarketplaceData {
    allItemListeds(first: 20, orderBy: [BLOCK_NUMBER_DESC, TX_INDEX_DESC]) {
      nodes {
        rindexerId
        seller
        nftAddress
        price
        tokenId
        contractAddress
        txHash
        blockNumber
      }
    }
    allItemCanceleds {
      nodes {
        nftAddress
        tokenId
      }
    }
    allItemBoughts {
      nodes {
        tokenId
        nftAddress
      }
    }
  }
`

async function fetchNFTs(): Promise<MarketplaceGraphQLData> {
    const response = await fetch("/api/graphql", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify({
            query: GET_RECENT_NFTS,
        }),
    })
    if (!response.ok) {
        console.error("HTTP Error:", response.status, response.statusText)
        throw new Error(`HTTP error! status: ${response.status}`)
    }
    const jsonResponse = await response.json()
    if (jsonResponse.errors) {
        console.error("GraphQL Errors:", jsonResponse.errors)
        throw new Error(
            `GraphQL error: ${jsonResponse.errors.map((e: { message: string }) => e.message).join(", ")}`
        )
    }
    return jsonResponse.data as MarketplaceGraphQLData
}

export function useRecentlyListedNFTs() {
    const { data, isLoading, error } = useQuery<MarketplaceGraphQLData>({
        queryKey: ["recentNFTs"],
        queryFn: fetchNFTs,
    })

    const nftDataList = useMemo((): RecentlyListedNft[] => {
        if (!data?.allItemListeds?.nodes) {
            return []
        }
        const boughtNFTs = new Set<string>()
        data.allItemBoughts?.nodes?.forEach(item => {
            if (item.nftAddress && item.tokenId) {
                boughtNFTs.add(`${item.nftAddress}-${item.tokenId}`)
            }
        })
        const cancelledNFTs = new Set<string>()
        data.allItemCanceleds?.nodes?.forEach(item => {
            if (item.nftAddress && item.tokenId) {
                cancelledNFTs.add(`${item.nftAddress}-${item.tokenId}`)
            }
        })
        const activeNfts = data.allItemListeds.nodes.filter(item => {
            if (!item.nftAddress || !item.tokenId) return false
            const key = `${item.nftAddress}-${item.tokenId}`
            return !boughtNFTs.has(key) && !cancelledNFTs.has(key)
        })
        const recentActiveNfts = activeNfts.slice(0, 100)
        return recentActiveNfts.map(nft => ({
            tokenId: nft.tokenId,
            contractAddress: nft.nftAddress,
            price: nft.price,
            seller: nft.seller,
        }))
    }, [data])

    return { isLoading, error, nftDataList }
}
