Below is a clean, end-to-end full-stack plan you can paste directly into your docs / Notion.
It explains BitGo + Fileverse + ENS integration and how the system works securely from treasury → employee claim.

⸻

Private Payroll System

BitGo + ENS + Fileverse Architecture

This system allows a company to distribute payroll privately while maintaining secure treasury management and encrypted employee contracts.

The architecture integrates:
	•	BitGo — company treasury and transaction signing
	•	Ethereum Name Service — employee identity layer
	•	Fileverse — encrypted document storage

⸻

System Architecture

Company Treasury (BitGo)
        ↓
Employee ENS Identity
        ↓
Encrypted Payroll Contract (Fileverse)
        ↓
Payroll Processor
        ↓
Payroll Pool Smart Contract
        ↓
Employee Withdrawal


⸻

Core Components

1. Treasury Layer (BitGo)

The company treasury is created using BitGo.

Responsibilities:
	•	hold company payroll funds
	•	sign payroll transactions
	•	trigger payroll execution
	•	manage treasury policies

Example treasury wallet creation:

BitGo.createWallet()

All payroll transactions are signed through the BitGo SDK.

Example transaction:

wallet.sendMany({
  recipients: [{ address: payrollPool, amount: totalPayroll }]
})

This ensures:
	•	MPC key security
	•	policy enforcement
	•	safe treasury operations

⸻

2. Identity Layer (ENS)

Each employee is assigned a company ENS subdomain.

Example:

alice.company.eth

ENS is used as the identity anchor.

ENS records store:

employeeWallet
docHash
stealthPublicKey

Example ENS mapping:

alice.company.eth → wallet: 0xEmployeeWallet

ENS ensures the system can resolve:

employee ENS → wallet identity


⸻

3. Payroll Contract Storage (Fileverse)

Employee payroll contracts are stored in Fileverse.

These documents contain:

employee ENS
salary amount
payment schedule
employment contract
withdrawal commitment

The document is encrypted so only the company and employee can read it.

Encryption model:

documentKey = random key
encryptedDocument = AES(documentKey, document)
encryptedKeyCompany = encrypt(documentKey, companyPublicKey)
encryptedKeyEmployee = encrypt(documentKey, employeePublicKey)

Stored structure:

{
 encryptedDoc,
 encryptedKeyCompany,
 encryptedKeyEmployee
}

Fileverse returns a CID.

Example:

CID = QmPayrollDoc123


⸻

4. Linking Fileverse to ENS

The Fileverse CID should not be public.

Instead we store a hash pointer in ENS.

Example:

docHash = hash(CID)

ENS record:

alice.company.eth → docHash

The actual CID is shared privately with the employee.

This ensures:
	•	ENS stays public
	•	payroll document remains private

⸻

5. Payroll Processor

The payroll processor is the backend service responsible for executing payroll.

Responsibilities:

retrieve employee records
verify Fileverse contracts
generate commitments
fund payroll pool

When payroll runs:
	1.	Fetch employee ENS records
	2.	Retrieve Fileverse documents using CID
	3.	Verify company treasury signature
	4.	Generate payroll commitments

Example commitment:

commitment = hash(employeeENS, salary, salt)

These commitments are registered in the payroll pool contract.

⸻

6. Payroll Pool Smart Contract

The payroll pool holds payroll funds and verifies employee claims.

Responsibilities:

store commitments
hold payroll funds
verify withdrawal proofs
release funds

Example contract structure:

mapping(bytes32 => uint256) commitments;

Commitment registration:

registerCommitment(commitment, salary)

The pool cannot see:

employee identity
salary metadata

Only commitments.

⸻

7. Payroll Funding

The company treasury funds the payroll pool.

Example flow:

BitGo Treasury
        ↓
PayrollPool Contract

Transaction signed using BitGo.

Example:

wallet.sendMany({
 address: payrollPool,
 amount: totalPayroll
})


⸻

8. Employee Payroll Claim

The employee connects their wallet.

The system resolves their ENS identity:

wallet → ENS lookup → alice.company.eth

The employee retrieves their Fileverse document.

Fileverse.get(CID)

Then decrypts it with their wallet key.

The document contains:

salary
salt
commitment
withdrawal proof


⸻

9. Withdrawal

The employee generates a proof locally.

Example:

proof = generateProof(commitment, salt)

Withdrawal transaction:

withdraw(proof, recipientWallet)

The payroll pool verifies:

hash(employeeENS, salary, salt) == commitment

If valid:

PayrollPool → recipientWallet

The employee can withdraw to any wallet.

⸻

Security Model

BitGo

Secures:

treasury funds
transaction signing
payroll funding


⸻

Fileverse

Secures:

employment contracts
salary metadata
payroll proofs

Encrypted storage ensures only company and employee can read data.

⸻

ENS

Provides:

identity resolution
wallet verification
document pointers

ENS is public but does not reveal payroll data.

⸻

Smart Contracts

Provide:

trustless payroll execution
withdrawal verification
fund custody


⸻

End-to-End Flow

Company creates BitGo treasury
        ↓
Company issues employee ENS
        ↓
Company creates encrypted payroll contract
        ↓
Upload document to Fileverse → CID
        ↓
Store CID hash in ENS
        ↓
Payroll processor generates commitments
        ↓
Treasury funds payroll pool
        ↓
Employee retrieves Fileverse document
        ↓
Employee generates withdrawal proof
        ↓
Employee withdraws funds


⸻

What Observers See On-Chain

Observers see only:

Treasury → PayrollPool
PayrollPool → random wallets

They cannot see:

employee salaries
employee identity mapping
employment contracts


⸻

Result

This system achieves:

secure treasury management
private payroll distribution
encrypted employee contracts
ENS-based identity resolution


⸻

If you want, I can also give you a much cleaner v2 architecture (with no backend payroll processor and everything automated on-chain) which would actually be stronger for a hackathon demo.