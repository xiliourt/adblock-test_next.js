'use client';

import { useState, useCallback, useMemo } from 'react'; // MODIFIED: Added useMemo
import { getInitialState, Category, DomainStatus } from '@/lib/domains';
import styles from './DomainTester.module.css'; // Import the CSS module

// A small component to display the status indicator dot
const StatusIndicator = ({ status }: { status: DomainStatus['status'] }) => {
  const statusClasses = {
    pending: styles.statusPending,
    reachable: styles.statusReachable,
    blocked: styles.statusBlocked,
  };
  return <div className={`${styles.statusIndicator} ${statusClasses[status]}`} />;
};

export default function DomainTester() {
  const [domainData, setDomainData] = useState<Category>(getInitialState);
  const [isTesting, setIsTesting] = useState(false);
  const [testedCount, setTestedCount] = useState(0);

  const totalDomains = Object.values(domainData).reduce(
    (acc, services) =>
      acc +
      Object.values(services).reduce(
        (serviceAcc, domains) => serviceAcc + domains.length,
        0
      ),
    0
  );

  // NEW: Calculate the total number of blocked domains using useMemo for efficiency
  const blockedCount = useMemo(() => {
    return Object.values(domainData).reduce(
      (acc, services) =>
        acc +
        Object.values(services).reduce(
          (serviceAcc, domains) =>
            serviceAcc + domains.filter(d => d.status === 'blocked').length,
          0
        ),
      0
    );
  }, [domainData]);

  // NEW: Calculate the blockage percentage
  const blockedPercentage = totalDomains > 0 ? Math.round((blockedCount / totalDomains) * 100) : 0;

  const updateDomainStatus = useCallback((category: string, service: string, domainName: string, status: DomainStatus['status']) => {
    setDomainData(prevData => {
      const newData = JSON.parse(JSON.stringify(prevData));
      const domainIndex = newData[category][service].findIndex((d: DomainStatus) => d.name === domainName);
      if (domainIndex !== -1) {
        newData[category][service][domainIndex].status = status;
      }
      return newData;
    });
    setTestedCount(prev => prev + 1);
  }, []);

  const checkDomain = async (domain: string): Promise<DomainStatus['status']> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      await fetch(`https://${domain}`, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeoutId);
      return 'reachable';
    } catch (error) {
      clearTimeout(timeoutId);
      return 'blocked';
    }
  };

  const handleStartTest = async () => {
    setIsTesting(true);
    setTestedCount(0);

    const allTestPromises = [];

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

  const handleReset = () => {
    setDomainData(getInitialState());
    setTestedCount(0);
    setIsTesting(false);
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>DNS Reachability Tester</h1>
        <p className={styles.description}>
          This tool checks if your browser can reach common ad, tracking, and analytics domains. Red means blocked (good!), Green means reachable.
        </p>
        <div className={styles.controls}>
          <button
            onClick={handleStartTest}
            disabled={isTesting}
            className={styles.button}
          >
            {isTesting ? 'Testing...' : 'Start Test'}
          </button>
          <button
            onClick={handleReset}
            disabled={isTesting}
            className={`${styles.button} ${styles.resetButton}`}
          >
            Reset
          </button>
        </div>
        {/* MODIFIED: Added blocked score display */}
        { (isTesting || testedCount > 0) && (
          <div className={styles.progressContainer}>
            <div className={styles.progressBar}>
              <div className={styles.progressBarInner} style={{ width: `${(testedCount/totalDomains) * 100}%` }}></div>
            </div>
            <p className={styles.progressText}>{testedCount} / {totalDomains} domains tested</p>
            {/* NEW: Blocked score display */}
            <p className={styles.progressText}>
              <strong>Blocked:</strong> {blockedCount} / {totalDomains} ({blockedPercentage}%)
            </p>
          </div>
        )}
      </div>

      <div className={styles.grid}>
        {Object.entries(domainData).map(([categoryName, services]) => (
          <div key={categoryName} className={styles.card}>
            <h2 className={styles.categoryTitle}>{categoryName}</h2>
            {Object.entries(services).map(([serviceName, domains]) => (
              <div key={serviceName} className={styles.service}>
                <h3 className={styles.serviceTitle}>{serviceName}</h3>
                <ul className={styles.domainList}>
                  {domains.map((domain) => (
                    <li key={domain.name} className={styles.domainItem}>
                      <StatusIndicator status={domain.status} />
                      <span>{domain.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
