-- Phase 16: manual KYC registration (server only) and duplicate detection
set role authenticated; select tests.as_user(tests.id('alice'));
select tests.throws($$select register_manual_kyc(tests.id('alice'), 'pan', 'h1', '234F', 'Alice', array[tests.id('alice')||'/a.png', tests.id('alice')||'/b.png'])$$, 'permission denied', 'customers cannot call register_manual_kyc');
reset role;

set role service_role; select tests.as_service();
select tests.throws($$select register_manual_kyc(tests.id('support'), 'aadhaar', 'h1', '1234', 'Bob', array[tests.id('support')||'/a.png', tests.id('support')||'/b.png'])$$, 'Unsupported document type', 'Aadhaar is not accepted');
select tests.throws($$select register_manual_kyc(tests.id('support'), 'pan', 'h1', '234F', 'Bob', array[tests.id('alice')||'/a.png', tests.id('support')||'/b.png'])$$, 'Invalid file', 'files must be in the customer''s own folder');
select tests.eq((register_manual_kyc(tests.id('support'), 'pan', 'hash-x1', '234F', 'Bob B', array[tests.id('support')||'/a.png', tests.id('support')||'/b.png'])->>'status'), 'manual_review', 'new documents go to manual review');
select tests.throws($$select register_manual_kyc(tests.id('support'), 'pan', 'hash-x1', '234F', 'Bob', array[tests.id('support')||'/a.png', tests.id('support')||'/b.png'])$$, 'already being reviewed', 'one review at a time');
select tests.eq((register_manual_kyc(tests.id('collector'), 'pan', 'hash-x1', '234F', 'Carol', array[tests.id('collector')||'/a.png', tests.id('collector')||'/b.png'])->>'status'), 'rejected', 'same ID on another account is rejected');
reset role;
