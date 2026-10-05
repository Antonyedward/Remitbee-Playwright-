// ─────────────────────────────────────────────────────────────────────────────
// Jenkinsfile — Remitbee CP Playwright flow suite (staging cp.wisecapitals.com)
//
// Modelled on selenium-java-v3/Jenkinsfile: same 'selenium' agent label, timestamps,
// milestone-based cancelling of older builds on non-master branches, and a parameter
// for the test group (smoke / regression). Differences:
//   - No Selenium Grid / Helm / Kubernetes stages: Playwright brings its own browser.
//     The build runs inside Microsoft's Playwright Docker image, which already has
//     Node and Chromium with all system libraries.
//   - No passwords in this file: they come from Jenkins credentials (see README §16).
//   - Reports: JUnit (trend graphs) + Playwright HTML report + failure screenshots/videos.
//
// The test logic lives in ci/jenkins-run.sh so it can be run and checked locally.
// ─────────────────────────────────────────────────────────────────────────────

if (env.BRANCH_NAME && env.BRANCH_NAME != 'master') {
    def buildNumber = env.BUILD_NUMBER as int
    if (buildNumber > 1) milestone(buildNumber - 1)
    milestone(buildNumber)
}

pipeline {
    agent {
        docker {
            // Must match the @playwright/test version in package-lock.json (currently 1.61.1).
            image 'mcr.microsoft.com/playwright:v1.61.1-noble'
            label 'selenium'
            args '--ipc=host'
        }
        // No Docker on the agent? Replace the block above with:
        //   agent { node { label 'selenium' } }
        // and make sure the agent has Node 18+; the "Install" stage then also needs:
        //   npx playwright install --with-deps chromium
    }

    parameters {
        choice(name: 'SUITE', choices: ['smoke', 'regression', 'all', 'module', 'test'],
               description: 'What to run. smoke ≈ 8 min, regression ≈ 40 min with 6 browsers.')
        choice(name: 'MODULE', choices: ['signup', 'auth', 'dashboard', 'send-money', 'exchange', 'wallet',
                                         'recipients', 'settings', 'transactions', 'rates', 'rewards', 'schedule',
                                         'verification', 'account', 'escalation', 'dtone', 'referral'],
               description: 'Only used when SUITE = module')
        string(name: 'TEST_ID', defaultValue: '', trim: true,
               description: 'Only used when SUITE = test, e.g. AC-07 or AC-(07|16)')
        string(name: 'WORKERS', defaultValue: 'auto', trim: true,
               description: 'Browsers in parallel: auto (worked out from the agent\'s CPUs and free memory, max MAX_WORKERS), a number such as 6, or a percentage of CPU cores such as 50%')
        string(name: 'MAX_WORKERS', defaultValue: '10', trim: true,
               description: 'Upper limit when WORKERS = auto (keeps staging from being overloaded)')
        booleanParam(name: 'SPLIT_SHARED_ACCOUNTS', defaultValue: true,
               description: 'Run Send Money (SM-) and Auth (PA-) with one browser after the rest (they share test accounts)')
    }

    environment {
        CI       = 'true'
        HEADLESS = 'true'
        BASE_URL = 'https://www.cp.wisecapitals.com'
        CORE_API = 'https://api.wisecapitals.com'
        NODE_OPTIONS = '--max-old-space-size=2048'
        npm_config_cache = "${env.WORKSPACE}/.npm"
    }

    options {
        timestamps()
        timeout(time: 4, unit: 'HOURS')
        buildDiscarder(logRotator(numToKeepStr: '30', artifactNumToKeepStr: '10'))
        disableConcurrentBuilds()   // one run at a time: tests share staging accounts
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                echo "Suite: ${params.SUITE}  Module: ${params.MODULE}  Test: ${params.TEST_ID}  Browsers: ${params.WORKERS} (max ${params.MAX_WORKERS})  Split: ${params.SPLIT_SHARED_ACCOUNTS}"
            }
        }

        stage('Install') {
            steps {
                sh '''
                    node -v
                    npm ci --no-audit --no-fund
                    npx playwright --version
                    rm -rf playwright-report junit-results test-results
                '''
            }
        }

        stage('Test') {
            steps {
                // Jenkins credentials (Secret text). Ask DevOps to create these two IDs.
                withCredentials([
                    string(credentialsId: 'remitbee-pw-common-password', variable: 'COMMON_PASSWORD'),
                    string(credentialsId: 'remitbee-pw-otp',             variable: 'ENTER_OTP')
                ]) {
                    script {
                        def rc = sh(returnStatus: true, script: '''
                            export SUITE="$SUITE" MODULE="$MODULE" TEST_ID="$TEST_ID" WORKERS="$WORKERS" MAX_WORKERS="$MAX_WORKERS" SPLIT_SHARED_ACCOUNTS="$SPLIT_SHARED_ACCOUNTS"
                            bash ci/jenkins-run.sh
                        ''')
                        if (rc != 0) {
                            unstable("Some tests failed (exit code ${rc}) — see the Playwright report")
                        }
                    }
                }
            }
        }
    }

    post {
        always {
            junit allowEmptyResults: true, testResults: 'junit-results/*.xml'
            script {
                // One HTML report per pass (main, shared, module or test)
                def passes = sh(returnStdout: true, script: 'ls playwright-report 2>/dev/null || true').trim()
                for (p in passes.tokenize('\n')) {
                    publishHTML(target: [
                        reportDir: "playwright-report/${p}",
                        reportFiles: 'index.html',
                        reportName: "Playwright report (${p})",
                        keepAll: true,
                        alwaysLinkToLastBuild: true,
                        allowMissing: true
                    ])
                }
            }
            archiveArtifacts artifacts: 'test-results/**/*, playwright-report/**/*', allowEmptyArchive: true, fingerprint: false
        }
    }
}
