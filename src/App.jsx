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
import './mobile-polish.css'
import './credibility-polish.css'
import './qa-fixes.css'

const faqItems = [
  {
    question: 'Why does my wallet show no distribution?',
    answer:
      'A no-match result means the completed indexed history contains no direct $ANSEM transfer from the configured distribution wallet to that public address. Confirm the address, mint and network before relying on the result.',
  },
  {
    question: 'Does the checker connect to my wallet?',
    answer:
      'No. The checker only reads public Solana Mainnet data. It never requests a wallet connection, private key, seed phrase, signature or transaction approval.',
  },
  {
    question: 'What does “Monitor delayed” mean?',
    answer:
      'It means the automatic monitor is not currently reporting an active polling state. Previously indexed verified data remains visible, and you can use Refresh data to request the latest available summary.',
  },
  {
    question: 'How can I independently verify a result?',
    answer:
      'Open the recipient, source wallet, mint and transaction links on Solscan. Compare the recipient, tracked mint, distribution wallet, amount and finalized transaction status.',
  },
  {
    question: 'What is the configured $ANSEM mint?',
    answer:
      'The configured mint is displayed near the wallet form with direct Solscan and Birdeye links. Always compare it with the token you expect before trusting a result.',
  },
  {
    question: 'Does a matching result prove the token is safe?',
    answer:
      'No. A match only confirms a transfer that meets this checker’s configured on-chain criteria. It is not financial advice, an endorsement or proof that the token is risk-free.',
  },
  {
    question: 'Can I paste a Solscan account link?',
    answer:
      'Yes. Paste either a public Solana address or a Solscan account URL. The checker extracts the address and validates that it decodes to a 32-byte Solana public key.',
  },
  {
    question: 'How often does the distribution monitor refresh?',
    answer:
      'The page requests fresh distribution data automatically and also provides a manual Refresh data button. The page-updated time shows when your browser last received a successful response.',
  },
]

function App() {
  const [result, setResult] = useState({ status: 'idle' })

  return (
    <div className="app" id="top">
      <Header />
      <main>
        <Hero onResult={setResult} />
        <HowItWorks />
        <WalletResult
          result={result}
          onReset={() => setResult({ status: 'idle' })}
        />
        <LiveDistributionMonitor />
        <CommunitySection />
        <SafetySection />
        <section className="faq" id="faq" aria-labelledby="faq-title">
          <h2 id="faq-title">Frequently asked questions</h2>
          <p className="faq-intro">
            Clear answers about wallet checks, monitoring, safety and independent verification.
          </p>
          <div className="faq-list">
            {faqItems.map(({ question, answer }) => (
              <details key={question}>
                <summary>
                  <span>{question}</span>
                  <b aria-hidden="true">+</b>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}

export default App
