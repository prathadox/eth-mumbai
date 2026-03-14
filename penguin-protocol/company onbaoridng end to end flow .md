Below is a clean, practical full-stack plan for company onboarding + employee onboarding with:
	•	BitGo login
	•	ENS subdomain issuance
	•	Fileverse contract creation
	•	Database schema
	•	Backend services
	•	Frontend flow

This is exactly what you can paste into your docs or README.

⸻

Private Payroll Onboarding Architecture

BitGo + ENS + Fileverse

This system allows companies to onboard employees securely while linking:
	•	treasury authority (BitGo)
	•	identity layer (ENS)
	•	employment contracts (Fileverse)

Employees must claim their ENS identity before a contract can be issued.

⸻

Tech Stack

Backend

Node.js
TypeScript
PostgreSQL
Express / Fastify

Web3

ethers.js
BitGo SDK
ENS resolver

Storage

Fileverse API

Frontend

Next.js
wagmi
rainbowkit


⸻

Core System Components

Frontend App
Backend API
BitGo Treasury
ENS Registry
Fileverse Storage
Database


⸻

Database Schema

Companies

Stores company treasury identity.

companies
---------
id
name
bitgo_wallet_id
ens_root
created_at

Example

id: 1
name: ACME
bitgo_wallet_id: wallet_abc
ens_root: acme.eth


⸻

Employees

Tracks employees invited by the company.

employees
---------
id
company_id
wallet_address
ens_name
status
created_at

Status values

invited
claimed
active

Example

wallet_address: 0x123...
ens_name: alice.acme.eth
status: invited


⸻

Contracts

Stores Fileverse references.

contracts
---------
id
employee_id
fileverse_cid
doc_hash
created_by_wallet
created_at

Example

employee_id: 7
fileverse_cid: QmXYZ
doc_hash: 0xabc123


⸻

Backend Services

auth-service
company-service
employee-service
ens-service
contract-service
fileverse-service
bitgo-service


⸻

1 Company Onboarding

Step 1 — Login via BitGo

Frontend

Connect BitGo wallet

Backend

POST /auth/bitgo

Backend verifies wallet.

Stores company.

Database

companies.insert({
 name,
 bitgo_wallet_id,
 ens_root
})


⸻

2 ENS Root Setup

Company must own ENS root.

Example

acme.eth

Backend verifies ownership.

resolveENSOwner(acme.eth)

Owner must match BitGo wallet.

⸻

3 Invite Employee

Company enters employee wallet.

Frontend

Invite employee

Backend

POST /employees/invite

Backend creates ENS subdomain.

alice.acme.eth

Database

employees.insert({
 company_id,
 wallet_address,
 ens_name,
 status: invited
})


⸻

4 Employee Claims ENS

Employee connects wallet.

Frontend

Claim ENS

Transaction

setSubnodeOwner(
 acme.eth,
 alice,
 employeeWallet
)

ENS now resolves

alice.acme.eth → employeeWallet

Backend verifies.

resolveENSOwner(alice.acme.eth)

Database update

status = claimed


⸻

5 Contract Creation Gate

Before contract creation:

if employee.status != claimed
    block contract creation

This ensures ENS identity is controlled by the employee.

⸻

6 Contract Creation

Company fills employment contract.

Example payload

{
 employeeENS: "alice.acme.eth",
 salary: 5000,
 interval: "monthly"
}

Backend encrypts contract.

⸻

Encryption Process

Generate symmetric key.

docKey = random()

Encrypt document.

encryptedDoc = AES(docKey, contract)

Encrypt key for recipients.

encrypt(docKey, companyPublicKey)
encrypt(docKey, employeePublicKey)


⸻

7 Upload to Fileverse

Backend calls

Fileverse.upload(encryptedDoc)

Response

CID

Example

QmPayroll123


⸻

8 Store Contract

Database

contracts.insert({
 employee_id,
 fileverse_cid,
 doc_hash: hash(CID),
 created_by_wallet
})


⸻

9 Link ENS to Contract

Instead of storing CID publicly:

ENS record stores hash.

alice.acme.eth
docHash = hash(CID)

This prevents CID leakage.

⸻

10 Employee Access

Employee opens dashboard.

Frontend flow

connect wallet
resolve ENS
get contract

Backend

GET /contracts/:employee

Returns CID.

Employee fetches document.

Fileverse.get(CID)

Then decrypts locally.

⸻

Complete Onboarding Flow

Company login via BitGo
      ↓
Company ENS root verified
      ↓
Company invites employee
      ↓
ENS subdomain created
      ↓
Employee claims ENS
      ↓
Backend verifies ownership
      ↓
Company issues contract
      ↓
Contract encrypted
      ↓
Uploaded to Fileverse
      ↓
CID stored in database
      ↓
Hash stored in ENS
      ↓
Employee retrieves contract


⸻

API Endpoints

POST /auth/bitgo
POST /companies/create
POST /employees/invite
POST /employees/claim
POST /contracts/create
GET  /contracts/:employee


⸻

Security Rules

Never store:

salary plaintext in DB
private keys
unencrypted documents

Database only stores:

CIDs
hashes
wallet addresses


⸻

What Each System Does

BitGo

company identity
treasury wallet
transaction signing

ENS

employee identity
ownership verification
contract pointer

Fileverse

encrypted employment contracts
secure document storage

Backend

workflow orchestration
contract encryption
database indexing


⸻

Final Result

The onboarding guarantees:

only ENS owner receives contract
contracts encrypted end-to-end
company treasury identity verified
employee identity bound to ENS


⸻

If you want, I can also show you the cleanest microservice architecture for this system (including queue workers and cron jobs) which will make the implementation much easier.