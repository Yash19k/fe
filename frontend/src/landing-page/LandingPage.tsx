import { useEffect } from "react"
import "./styles/landing.css"
import styles from "./styles/styles.module.css"
import RevealWatcher from "./components/RevealWatcher"
import Navbar from "./components/Navbar"
import Hero from "./components/Hero"
import ProductPreview from "./components/ProductPreview"
import FeatureStrip from "./components/FeatureStrip"
import Features from "./components/Features"
import Benefits from "./components/Benefits"
import HowItWorks from "./components/HowItWorks"
import Integrations from "./components/Integrations"
import FAQ from "./components/FAQ"
import Newsletter from "./components/Newsletter"
import Footer from "./components/Footer"
import SvgDefs from "./components/SvgDefs"
import SmoothScroll from "./components/SmoothScroll"

export default function LandingPage() {
  useEffect(() => {
    const originalTitle = document.title
    document.title = "TaskFlow Pro — Modern Project Management & Team Collaboration"

    // Set meta description if present
    const metaDesc = document.querySelector('meta[name="description"]')
    const originalDesc = metaDesc ? metaDesc.getAttribute('content') : ''
    if (metaDesc) {
      metaDesc.setAttribute(
        'content',
        'Plan projects, manage tasks, coordinate sprints, and collaborate in real-time with TaskFlow Pro.'
      )
    }

    return () => {
      document.title = originalTitle
      if (metaDesc && originalDesc) {
        metaDesc.setAttribute('content', originalDesc)
      }
    }
  }, [])

  return (
    <div className="landing-page-root">
      <RevealWatcher />
      <div className={styles["div-61"]}>
        <div className={styles["div-62"]}>
          {/* Top navigation */}
          <div className={styles["taskflow-navigation"]}>
            <div className={styles["div-63"]}>
              <Navbar />
            </div>
          </div>

          <div className={styles["div-64"]}>
            <div className={styles["div-65"]}>
              <SmoothScroll slots={[]} />
            </div>

            <main className={styles["main"]}>
              {/* Hero Section */}
              <Hero />

              {/* Product Dashboard Preview */}
              <ProductPreview />

              {/* Client / Feature Logo Strip */}
              <FeatureStrip />

              {/* Features Showcase */}
              <Features />

              {/* Why TaskFlow / Benefits Section */}
              <Benefits />

              {/* How It Works (3 Steps) */}
              <HowItWorks />

              {/* Integrations & Connected Workspace */}
              <Integrations />

              {/* Frequently Asked Questions */}
              <FAQ />

              {/* Newsletter / Stay Connected */}
              <Newsletter />
            </main>
          </div>

          <div className={styles["div-5"]} />
          <div className={styles["div-90"]} />

          {/* Footer & Final Call to Action */}
          <div className={styles["taskflow-pro-footer"]}>
            <div className={styles["div-63"]}>
              <Footer />
            </div>
          </div>
        </div>
      </div>

      {/* SVG Symbol Definitions */}
      <SvgDefs />
    </div>
  )
}

