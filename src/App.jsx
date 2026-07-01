import { useState } from 'react'
import Header from './components/Header'
import Hero from './components/Hero'
import HowItWorks from './components/HowItWorks'
import WalletResult from './components/WalletResult'
import LiveDistributionMonitor from './components/LiveDistributionMonitor'
import CommunitySection from './components/CommunitySection'
import SafetySection from './components/SafetySection'
import Footer from './components/Footer'
import './App.css'
import './responsive-fixes.css'

function App() {
  const [result, setResult] = useState({ status: 'idle' })
  return <div className="app" id="top"><Header/><main><Hero onResult={setResult}/><HowItWorks/><WalletResult result={result} onReset={() => setResult({ status: 'idle' })}/><LiveDistributionMonitor/><CommunitySection/><SafetySection/><section className="faq" id="faq"><h2>FAQ</h2><p>This tool checks public Solana Mainnet transaction data for a configured $ANSEM distribution wallet and mint. It never connects to wallets or asks for approvals.</p></section></main><Footer/></div>
}
export default App
