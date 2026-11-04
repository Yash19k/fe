import React, { useState } from "react"
import styles from "../styles/styles.module.css"
import { SvgGraphic } from "./RichText"
import { TaskFlowBrand } from "./TaskFlowLogo"
import { useApp } from "../../hooks/useApp"
import { ThemeToggle } from "../../components/ui/ThemeToggle"
import { Menu, X, ArrowRight, LayoutDashboard } from "lucide-react"

export default function Navbar({ slots = [] }: { slots?: string[] }) {
  const { navigate, currentUser } = useApp()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const isAuthenticated = Boolean(currentUser && currentUser.id && currentUser.email)

  const scrollTo = (id: string) => {
    setMobileMenuOpen(false)
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const handleBrandClick = (e: React.MouseEvent) => {
    e.preventDefault()
    scrollTo('hero')
  }

  return (
    <>
      <nav className={styles["desktop"]}>
        <div className={styles["navigation-content"]}>
          <div className={styles["brand-and-menu"]}>
            <TaskFlowBrand
              variant="nav"
              wordmark={slots[0] ?? "TaskFlow"}
              href="#hero"
              onClick={handleBrandClick}
            />
          </div>

          <div className={styles["links-and-get-started"]}>
            <div className={styles["section-links"]}>
              <a className={styles["features"]} href="#features" onClick={(e) => { e.preventDefault(); scrollTo('features'); }}>
                <div className={styles["features-label"]}>
                  <div className={styles["p-3"]}>
                    <span className={styles["span-2"]}>{slots[1] ?? "Features"}</span>
                  </div>
                </div>
              </a>
              <a className={styles["benefits"]} href="#benefits" onClick={(e) => { e.preventDefault(); scrollTo('benefits'); }}>
                <div className={styles["benefits-label"]}>
                  <div className={styles["p-4"]}>
                    <span className={styles["span-2"]}>{slots[2] ?? "Benefits"}</span>
                  </div>
                </div>
              </a>
              <a className={styles["how-it-works"]} href="#how-it-works" onClick={(e) => { e.preventDefault(); scrollTo('how-it-works'); }}>
                <div className={styles["how-it-works-label"]}>
                  <div className={styles["p-5"]}>
                    <span className={styles["span-2"]}>{slots[3] ?? "How It Works"}</span>
                  </div>
                </div>
              </a>
              <a className={styles["integrations"]} href="#integrations" onClick={(e) => { e.preventDefault(); scrollTo('integrations'); }}>
                <div className={styles["integrations-label"]}>
                  <div className={styles["p-6"]}>
                    <span className={styles["span-2"]}>{slots[4] ?? "Integrations"}</span>
                  </div>
                </div>
              </a>
              <a className={styles["faq"]} href="#faq" onClick={(e) => { e.preventDefault(); scrollTo('faq'); }}>
                <div className={styles["faq-label"]}>
                  <div className={styles["p-7"]}>
                    <span className={styles["span-2"]}>{slots[5] ?? "FAQ"}</span>
                  </div>
                </div>
              </a>
              <a className={styles["resources"]} href="#how-it-works" onClick={(e) => { e.preventDefault(); scrollTo('how-it-works'); }}>
                <div className={styles["resources-label"]}>
                  <div className={styles["p-8"]}>
                    <span className={styles["span-2"]}>{slots[6] ?? "Resources"}</span>
                  </div>
                </div>
              </a>
            </div>

            {/* Action buttons + Theme Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <ThemeToggle />

              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="landing-nav-signin-btn"
                  style={{ gap: '6px' }}
                >
                  <LayoutDashboard size={14} />
                  <span>Go to App</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="landing-nav-signin-btn"
                  >
                    Sign In
                  </button>

                  <div className={styles["get-started-configure-signup-url"]}>
                    <a
                      className={styles["button"]}
                      href="#/signup"
                      onClick={(e) => { e.preventDefault(); navigate('/signup'); }}
                    >
                      <div className={styles["div-2"]}>
                        <p className={styles["p-9"]}>{slots[7] ?? "Get Started"}</p>
                      </div>
                      <div className={styles["div-3"]}>
                        <div className={styles["div-4"]}>
                          <div className={styles["p-10"]}>
                            <span className={styles["span-3"]}>{slots[8] ?? "G"}</span>
                            <span className={styles["span-4"]}>{slots[9] ?? "e"}</span>
                            <span className={styles["span-5"]}>{slots[10] ?? "t"}</span>
                            <div className={styles["span-6"]} />
                            <span className={styles["span-4"]}>{slots[11] ?? "S"}</span>
                            <span className={styles["span-5"]}>{slots[12] ?? "t"}</span>
                            <span className={styles["span-4"]}>{slots[13] ?? "a"}</span>
                            <span className={styles["span-7"]}>{slots[14] ?? "r"}</span>
                            <span className={styles["span-5"]}>{slots[15] ?? "t"}</span>
                            <span className={styles["span-4"]}>{slots[16] ?? "e"}</span>
                            <span className={styles["span-4"]}>{slots[17] ?? "d"}</span>
                          </div>
                        </div>
                      </div>
                    </a>
                  </div>
                </>
              )}

              {/* Mobile menu hamburger button */}
              <button
                type="button"
                className="landing-mobile-menu-btn"
                onClick={() => setMobileMenuOpen(prev => !prev)}
                aria-label="Toggle mobile menu"
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="landing-mobile-drawer animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="landing-mobile-brand">
            <TaskFlowBrand
              variant="nav"
              wordmark={slots[0] ?? "TaskFlow"}
              href="#hero"
              onClick={handleBrandClick}
            />
          </div>

          <a className="landing-mobile-nav-link" onClick={() => scrollTo('features')}>Features</a>
          <a className="landing-mobile-nav-link" onClick={() => scrollTo('benefits')}>Benefits</a>
          <a className="landing-mobile-nav-link" onClick={() => scrollTo('how-it-works')}>How It Works</a>
          <a className="landing-mobile-nav-link" onClick={() => scrollTo('integrations')}>Integrations</a>
          <a className="landing-mobile-nav-link" onClick={() => scrollTo('faq')}>FAQ</a>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
            {isAuthenticated ? (
              <button
                onClick={() => { setMobileMenuOpen(false); navigate('/'); }}
                className="landing-nav-signin-btn"
                style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
              >
                Go to Workspace Dashboard
              </button>
            ) : (
              <>
                <button
                  onClick={() => { setMobileMenuOpen(false); navigate('/login'); }}
                  className="landing-nav-signin-btn"
                  style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
                >
                  Sign In
                </button>
                <button
                  onClick={() => { setMobileMenuOpen(false); navigate('/signup'); }}
                  className="landing-nav-signin-btn"
                  style={{ width: '100%', justifyContent: 'center', padding: '12px', backgroundColor: '#6366f1', color: '#ffffff', borderColor: '#6366f1' }}
                >
                  Get Started Free
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

