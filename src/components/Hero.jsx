import WalletChecker from './WalletChecker'
import { Icon } from './Icons'
export default function Hero({ onResult }) {
  return <section className="hero" aria-labelledby="hero-title"><div className="hero-copy"><p className="badge"><span />SOLANA MAINNET</p><h1 id="hero-title">$ANSEM Wallet<br/>Distribution Checker</h1><p className="lead">Check whether a public Solana wallet received a direct $ANSEM distribution from the wallet tracked by this community tool.</p><div className="security-row"><span><Icon name="shield"/>Read-only</span><span><Icon name="lock"/>No wallet connection</span><span><Icon name="check"/>No transaction approval</span></div><p className="info-notice"><Icon name="lock"/>We never access your wallet. We only read public data on Solana.</p></div><WalletChecker onResult={onResult}/></section>
}
