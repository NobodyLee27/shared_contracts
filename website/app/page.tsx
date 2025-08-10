'use client'

import { WagmiProvider, http } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createConfig } from 'wagmi'
import { polygonAmoy, sepolia, arbitrumSepolia } from 'wagmi/chains'
import { injected, metaMask, walletConnect } from '@wagmi/connectors'
import WagmiSignPermit2 from '@/components/WagmiSignPermit2'
import WagmiSign from '@/components/WagmiSign'
// 0x0f404eF20C8CC6347ce2d2cD8dc872b3093bdccB

const queryClient = new QueryClient()
const config = createConfig({
  chains: [polygonAmoy, sepolia, arbitrumSepolia],
  connectors: [
    metaMask(),
    walletConnect({
      projectId: 'd055f5fe4129ec10d77fe8e68980e7fb',
    }),
    injected(),
  ],
  transports: {
    // [polygonAmoy.id]: http('https://polygon-amoy.infura.io/v3/84c45d069b5347459844c6869a6c2485'),
    [polygonAmoy.id]: http('https://polygon-amoy.g.alchemy.com/v2/vkZ5WPCV0qB9Gye9sajMsn9YhdSl7Shy'),
    // [polygonAmoy.id]: http('https://rpc.ankr.com/polygon_amoy/75d0c18a2428def4526a87deb05a13fa59e6d32398707c7cd7f21555f6918162'),

    [sepolia.id]: http('https://eth-sepolia.g.alchemy.com/v2/vkZ5WPCV0qB9Gye9sajMsn9YhdSl7Shy'),

    [arbitrumSepolia.id]: http('https://arb-sepolia.g.alchemy.com/v2/vkZ5WPCV0qB9Gye9sajMsn9YhdSl7Shy'),
    
  },
})

export default function Home() {
  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
       <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
              <WagmiSign />
              <br />
              <WagmiSignPermit2 />
          </QueryClientProvider>
        </WagmiProvider>
    </div>
  );
}
