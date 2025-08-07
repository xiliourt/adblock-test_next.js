'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { getInitialState, Category, DomainStatus } from '@/lib/domains';
import styles from './AdblockTest.module.css'; // Import the CSS module

// ============================================================================
//  ICON COMPONENTS
// ============================================================================
const CheckIcon = () => <span className={styles.icon}>✔</span>;
const CrossIcon = () => <span className={styles.icon}>✗</span>;
const PendingIcon = () => <span className={styles.icon}>...</span>;

// ============================================================================
//  UI SUB-COMPONENTS
// ============================================================================

const ResultsDonutChart = ({
  percentage,
  blockedCount,
  notBlockedCount,
}: {
  percentage: number;
  blockedCount: number;
  notBlockedCount: number;
}) => {
  const
 
radius = 60;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className={styles.resultsContainer}>
      <div className={styles.donutChart}>
        <svg>
          <circle className={styles.donutTrack} cx="75" cy="75" r={radius} fill="transparent" strokeWidth="15" />
          <circle
            className={styles.donutIndicator}
            cx="75" cy="75" r={radius} fill="transparent" strokeWidth="15"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className={styles.chartText}>
          <div className={styles.chartPercentage}>{percentage}%</div>
          <div className={styles.chartLabel}>Blocked</div>
        </div>
      </div>
      <div className={styles.resultCounts}>
        <div>
          <span className={styles.blockedCount}>{blockedCount}</span>
          <div className={styles.chartLabel}>Blocked</div>
        </div>
        <div>
          <span className={styles.notBlockedCount}>{notBlockedCount}</span>
          <div className={styles.chartLabel}>Not Blocked</div>
        </div>
      </div>
    </div>
  );
};

const InfoAccordion = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <details className={styles.infoAccordion}>
    <summary>{title}</summary>
    <div>{children}</div>
  </details>
);

const DomainListItem = ({ domain }: { domain: DomainStatus }) => {
  let icon;
  let statusClass = '';

  switch (domain.status) {
    case 'blocked':
      icon = <CheckIcon />;
      statusClass = styles.blocked;
      break;
    case 'reachable':
      icon = <CrossIcon />;
      statusClass = styles.reachable;
      break;
    default:
      icon = <PendingIcon />;
      break;
  }
  return (
    <li className={`${styles.domainItem} ${statusClass}`}>
      {icon}
      <span>{domain.name}</span>
    </li>
  );
};

// ============================================================================
//  MAIN COMPONENT
// ============================================================================

export default function DomainTester() {
  const [domainData, setDomainData] = useState<Category>(getInitialState);
  const [isTesting, setIsTesting] = useState(false);
  const [testedCount, setTestedCount] = useState(0);

  const totalDomains = useMemo(() => Object.values(domainData).reduce(
    (acc, services) => acc + Object.values(services).reduce((sAcc, d) => sAcc + d.length, 0), 0
  ), [domainData]);

  const { blockedCount, notBlockedCount } = useMemo(() => {
    let blocked = 0;
    let reachable = 0;
    for (const category in domainData) {
      for (const service in domainData[category]) {
        for (const domain of domainData[category][service]) {
          if (domain.status === 'blocked') blocked++;
          else if (domain.status === 'reachable') reachable++;
        }
      }
    }
    return { blockedCount: blocked, notBlockedCount: reachable };
  }, [domainData]);

  const blockedPercentage = totalDomains > 0 ? Math.round((blockedCount / totalDomains) * 100) : 0;

  const updateDomainStatus = useCallback((category: string, service: string, domainName: string, status: DomainStatus['status']) => {
    setDomainData(prevData => {
      const newData = { ...prevData };
      const domainIndex = newData[category][service].findIndex(d => d.name === domainName);
      if (domainIndex !== -1) {
        newData[category][service][domainIndex] = { ...newData[category][service][domainIndex], status };
      }
      return newData;
    });
    setTestedCount(prev => prev + 1);
  }, []);

  const checkDomain = async (domain: string): Promise<DomainStatus['status']> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      await fetch(`https://${domain}`, { method: 'HEAD', mode: 'no-cors', signal: controller.signal, cache: 'no-store' });
      clearTimeout(timeoutId);
      return 'reachable';
    } catch (error) {
      clearTimeout(timeoutId);
      return 'blocked';
    }
  };

  const handleStartTest = async () => {
    setDomainData(getInitialState());
    setTestedCount(0);
    setIsTesting(true);

    const allTestPromises: Promise<void>[] = [];
    for (const categoryName in domainData) {
        for (const serviceName in domainData[categoryName]) {
            for (const domain of domainData[categoryName][serviceName]) {
                const promise = checkDomain(domain.name).then(status => {
                    updateDomainStatus(categoryName, serviceName, domain.name, status);
                });
                allTestPromises.push(promise);
            }
        }
    }
    await Promise.all(allTestPromises);
    setIsTesting(false);
  };

  const testIsFinished = !isTesting && testedCount === totalDomains && totalDomains > 0;

  return (
    <div className={styles.pageLayout}>
      {/* --- Sidebar (Left Column) --- */}
      <aside className={styles.sidebar}>
        {testIsFinished ? (
          <ResultsDonutChart
            percentage={blockedPercentage}
            blockedCount={blockedCount}
            notBlockedCount={notBlockedCount}
          />
        ) : (
          <div className={styles.resultsContainer}>
             <h3 style={{textAlign: 'center', marginTop: 0}}>Ad Block Test</h3>
             <p style={{textAlign: 'center', color: 'var(--text-secondary)'}}>
                {isTesting ? `Testing ${testedCount}/${totalDomains}...` : "Press 'Re-test' to begin."}
             </p>
          </div>
        )}

        <div className={styles.actionsContainer}>
          <button onClick={handleStartTest} disabled={isTesting} className={styles.retestButton}>
            {isTesting ? 'Testing...' : 'Re-test'}
          </button>
        </div>
      </aside>

      {/* --- Main Content (Right Column) --- */}
      <main className={styles.mainContent}>
        {Object.entries(domainData).map(([categoryName, services]) => {
          // NEW: Logic to determine the status of the entire category
          const allDomainsInCategory = Object.values(services).flat();
          const categoryIsTested = allDomainsInCategory.every(d => d.status !== 'pending');
          let categoryStatusClass = '';

          if (categoryIsTested) {
            const hasFailures = allDomainsInCategory.some(d => d.status === 'reachable');
            categoryStatusClass = hasFailures ? styles.someFailed : styles.allBlocked;
          }

          return (
            <div key={categoryName} className={`${styles.categoryCard} ${categoryStatusClass}`}>
              <h2 className={styles.categoryTitle}>{categoryName}</h2>
              {/* NEW: Flex container for service groups */}
              <div className={styles.servicesContainer}>
                {Object.entries(services).map(([serviceName, domains]) => (
                  <div key={serviceName} className={styles.serviceGroup}>
                    <h3 className={styles.serviceTitle}>{serviceName}</h3>
                    <ul className={styles.domainList}>
                      {domains.map(domain => (
                        <DomainListItem key={domain.name} domain={domain} />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
