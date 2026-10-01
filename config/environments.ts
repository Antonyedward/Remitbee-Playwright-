import * as dotenv from 'dotenv';
dotenv.config();

/**
 * One password for every staging test account (confirmed by QA, 2026-09-30).
 * Override with COMMON_PASSWORD in .env if it ever changes. The per-account
 * *_PASSWORD variables in .env are intentionally ignored so a stale value there
 * (e.g. the old SEND_MONEY_DEBIT_PASSWORD=Business@123) can't break logins.
 * INVALID_PASSWORD is NOT included — negative-login tests need a wrong password.
 */
const COMMON_PASSWORD = process.env.COMMON_PASSWORD || 'Test@1234567';

export const ENV = {
  // ── Core ──────────────────────────────────────────────────────────────────
  BASE_URL: process.env.BASE_URL || 'https://www.cp.wisecapitals.com',
  CORE_API: process.env.CORE_API || 'https://api.wisecapitals.com',

  // ── Personal account ──────────────────────────────────────────────────────
  PERSONAL_EMAIL: process.env.PERSONAL_EMAIL || 'remittest012@gmail.com',
  USER_PASSWORD: COMMON_PASSWORD,
  // ENTER_OTP: set to a 6-digit static OTP code (e.g. '121212') if OTP is disabled on test accounts,
  //            OR a Base32 TOTP secret (e.g. 'JBSWY3DPEHPK3PXP') if 2FA is enabled.
  //            If test accounts have 2FA disabled, this value is never used.
  ENTER_OTP: process.env.ENTER_OTP || '121212',

  // ── Business account ──────────────────────────────────────────────────────
  BUSINESS_EMAIL: process.env.BUSINESS_EMAIL || 'remittestbusinessbee@gmail.com',
  BUSINESS_PASSWORD: COMMON_PASSWORD,

  // ── Edge-case accounts ────────────────────────────────────────────────────
  BLOCKED_EMAIL: process.env.BLOCKED_EMAIL || 'remittest-p09@gmail.com',
  RESTRICTED_EMAIL: process.env.RESTRICTED_EMAIL || 'remittest-123@gmail.com',
  DELETED_EMAIL: process.env.DELETED_EMAIL || 'remittestdeletedacc@gmail.com',
  FORGET_PASSWORD_EMAIL: process.env.FORGET_PASSWORD_EMAIL || 'remittesttestlevels@gmail.com',

  // ── Invalid credentials ───────────────────────────────────────────────────
  INVALID_USERNAME: process.env.INVALID_USERNAME || 'remittest@gmail',
  INVALID_PASSWORD: process.env.INVALID_PASSWORD || 'Test@321',
  EMAIL_WITH_SPACE: process.env.EMAIL_WITH_SPACE || 'remittest 012@gmail.com',

  // ── Send money ────────────────────────────────────────────────────────────
  SEND_MONEY_AMOUNT: process.env.SEND_MONEY_AMOUNT || '12',
  INITIATE_SEND_MONEY: process.env.INITIATE_SEND_MONEY || '1000',
  SEND_MONEY_DEBIT_EMAIL: process.env.SEND_MONEY_DEBIT_EMAIL || 'remittestj27.4@mail.com',
  SEND_MONEY_DEBIT_PASSWORD: COMMON_PASSWORD,
  SEND_MONEY_WITHOUT_BALANCE_EMAIL: process.env.SEND_MONEY_WITHOUT_BALANCE_EMAIL || 'remittest-sendmoney@gmail.com',

  // ── Currency Exchange ─────────────────────────────────────────────────────
  CE_AMOUNT: process.env.CE_AMOUNT || '100',
  CE_LESS_AMOUNT: process.env.CE_LESS_AMOUNT || '1',
  PERSONAL_NO_BALANCE_EMAIL: process.env.PERSONAL_NO_BALANCE_EMAIL || 'remittest-priyap1p1p1@gmail.com',
  BUSINESS_NO_BALANCE_EMAIL: process.env.BUSINESS_NO_BALANCE_EMAIL || 'remittest-business0wallet@gmail.com',
  BUSINESS_WITH_WALLET_EMAIL: process.env.BUSINESS_WITH_WALLET_EMAIL || 'remittestfirstbusiness@gmail.com',
  CE_SUFFICIENT_BALANCE_EMAIL: process.env.CE_SUFFICIENT_BALANCE_EMAIL || 'remittestautomationwallet1@gmail.com',
  FIRST_TIME_USER_EMAIL: process.env.FIRST_TIME_USER_EMAIL || 'remittestfirsttime@gmail.com',

  // ── Verification level accounts ───────────────────────────────────────────
  LEVEL1_EMAIL: process.env.LEVEL1_EMAIL || 'remittestl1acc@gmail.com',
  LEVEL2_EMAIL: process.env.LEVEL2_EMAIL || 'remittestl2account@gmail.com',
  LEVEL3_EMAIL: process.env.LEVEL3_EMAIL || 'remittestl3account@gmail.com',
  LEVEL4_EMAIL: process.env.LEVEL4_EMAIL || 'remittestl4account@gmail.com',
  VL1_LIMIT_CHECK_EMAIL: process.env.VL1_LIMIT_CHECK_EMAIL || 'remittest-verifiacationlevel1limitcheck@gmail.com',
  VL2_LIMIT_CHECK_EMAIL: process.env.VL2_LIMIT_CHECK_EMAIL || 'remittest-verifiacationlevel2limitcheck@gmail.com',
  VL3_LIMIT_CHECK_EMAIL: process.env.VL3_LIMIT_CHECK_EMAIL || 'remittest-verifiacationlevel3limitcheck@gmail.com',
  VL4_LIMIT_CHECK_EMAIL: process.env.VL4_LIMIT_CHECK_EMAIL || 'remittest-verifiacationlevel4limitcheck@gmail.com',

  // ── CAD Balance / Wallet ──────────────────────────────────────────────────
  CAD_BALANCE_EMAIL: process.env.CAD_BALANCE_EMAIL || 'remittestautomationwallet1@gmail.com',
  CAD_NO_BALANCE_EMAIL: process.env.CAD_NO_BALANCE_EMAIL || 'remittestnowallet@gmail.com',
  CAD_LOW_BALANCE_EMAIL: process.env.CAD_LOW_BALANCE_EMAIL || 'remittestlowbalance@gmail.com',
  CAD_WITHDRAW_AMOUNT: process.env.CAD_WITHDRAW_AMOUNT || '10',
  SAVED_BANK_EMAIL: process.env.SAVED_BANK_EMAIL || 'remittest011@gmail.com',

  // ── Rates ─────────────────────────────────────────────────────────────────
  RATES_EMAIL: process.env.RATES_EMAIL || 'remittestrates@gmail.com',

  // ── Rewards ───────────────────────────────────────────────────────────────
  REWARDS_EMAIL: process.env.REWARDS_EMAIL || 'remittest-priyap1p1p1@gmail.com',
  PROMO_CODE: process.env.PROMO_CODE || 'TESTPERS',
  INVALID_PROMO_CODE: process.env.INVALID_PROMO_CODE || 'INVALIDPROMOCODE',
  BUSINESS_PROMO_CODE: process.env.BUSINESS_PROMO_CODE || 'PROMOBE1',

  // ── Transactions ──────────────────────────────────────────────────────────
  TX_HISTORY_EMAIL: process.env.TX_HISTORY_EMAIL || 'remittest-keerthi002@gmail.com',

  // ── DTone ─────────────────────────────────────────────────────────────────
  DTONE_MOBILE_PHONE: process.env.DTONE_MOBILE_PHONE || '7067491101',
  DTONE_SUCCESS_COUNTRY: process.env.DTONE_SUCCESS_COUNTRY || 'Nigeria',
  DTONE_BILL_PAYMENT_COUNTRY: process.env.DTONE_BILL_PAYMENT_COUNTRY || 'India',   // staging bills: India only (Jam 21b71844)
  DTONE_BILL_UTILITY: process.env.DTONE_BILL_UTILITY || 'VOIP',
  DTONE_GIFT_CARD_COUNTRY: process.env.DTONE_GIFT_CARD_COUNTRY || 'India',     // staging gift cards: India / United States only
  DTONE_BILL_PAYMENT_MOBILE: process.env.DTONE_BILL_PAYMENT_MOBILE || '9876543210',
  DTONE_ESIM_COUNTRY: process.env.DTONE_ESIM_COUNTRY || 'can',
  DTONE_QR_EMAIL: process.env.DTONE_QR_EMAIL || 'remittest-k@gmail.com',
  DTONE_QR_PASSWORD: COMMON_PASSWORD,
  DTONE_CREDIT_CARD_1: process.env.DTONE_CREDIT_CARD_1 || '5548859910035010',
  DTONE_CARD_EXPIRE: process.env.DTONE_CARD_EXPIRE || '04/27',
  DTONE_CARD_CVV: process.env.DTONE_CARD_CVV || '123',

  // ── Account details / Settings ────────────────────────────────────────────
  ACCOUNT_FIRST_NAME: process.env.ACCOUNT_FIRST_NAME || 'John',
  ACCOUNT_LAST_NAME: process.env.ACCOUNT_LAST_NAME || 'Doe',
  ACCOUNT_ADDRESS: process.env.ACCOUNT_ADDRESS || '110 Lakeshore street',
  ACCOUNT_CITY: process.env.ACCOUNT_CITY || 'Toronto',
  ACCOUNT_PROVINCE: process.env.ACCOUNT_PROVINCE || 'Ontario',
  ACCOUNT_POSTAL_CODE: process.env.ACCOUNT_POSTAL_CODE || 'A1B 2C3',
  ACCOUNT_OCCUPATION: process.env.ACCOUNT_OCCUPATION || 'Academic Deans',

  // ── Referral ──────────────────────────────────────────────────────────────
  REFERRAL_CODE: process.env.REFERRAL_CODE || 'remitest123',

  // ── API helpers ───────────────────────────────────────────────────────────
  REQUEST_API: process.env.REQUEST_API || '/internal-services/qa-automation/auth/reset-password-link?email=',
  LOGOUT_URL: process.env.LOGOUT_URL || 'https://www.cp.wisecapitals.com/logout',
};
