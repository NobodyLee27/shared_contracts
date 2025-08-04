'use client'

import { WagmiProvider, http } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createConfig } from 'wagmi'
import { mainnet, sepolia, polygonAmoy } from 'wagmi/chains'
import { injected, metaMask, walletConnect } from '@wagmi/connectors'
import WagmiSignPermit2 from '@/components/WagmiSignPermit2'
import WagmiSign from '@/components/WagmiSign'

const queryClient = new QueryClient()
const config = createConfig({
  chains: [polygonAmoy],
  connectors: [
    metaMask(),
    walletConnect({
      projectId: '1234567890',
    }),
    injected(),
  ],
  transports: {
    [polygonAmoy.id]: http('https://polygon-amoy.infura.io/v3/84c45d069b5347459844c6869a6c2485'),
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
