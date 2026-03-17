## Introduction to StellarPoll :
 Stellar poll is a simple voting dapp which allows you to vote on a question via freighter wallet.✨
 
 ## Pre-Requesits to Run :

 1. Download Freighter wallet web extension.
 2. set up your Freighter Wallet.
 3. VS code should be installed
    
 ## How To Run :

 open in VS code ----> Go to Terminal ----> cd Frontend ----> Give a command "npm run dev" ----> Run on Localhost (CTRL + click) ----->You're Ready To Go. 🚀 

 or

 simply click on deployed dapp link (deployed via vercel)

## Working Screenshots :

<img width="1918" height="871" alt="image" src="https://github.com/user-attachments/assets/e187763c-4f3e-4212-a12e-b3966729c6f9" />

<img width="1915" height="872" alt="image" src="https://github.com/user-attachments/assets/7efe31db-8438-4654-8ec7-03b8017ce3be" />

<img width="1918" height="867" alt="image" src="https://github.com/user-attachments/assets/807ec1d8-bf58-4c5b-85f9-c076c502e481" />

<img width="1918" height="866" alt="image" src="https://github.com/user-attachments/assets/d6268c9a-a65c-4332-8b8b-276feaf2124c" />


## Contract Details :

CONTRACT_ID : 'CCF72V6Y2HN2L2OO7VXHRIW7IHRJDUJUM2X6LY4KFZ6JVZU3J5F75BKB'

-View On Stellar Expert :
<img width="1916" height="870" alt="image" src="https://github.com/user-attachments/assets/c9d765b6-fd4f-4563-a287-111bae56ee74" />

- Frieghter transaction history :
<img width="447" height="745" alt="image" src="https://github.com/user-attachments/assets/09a7c382-07ed-4bab-862c-e9b436cd6946" />


## Test results (Passed 6 Tests) :

1.test_init_and_vote :

test test::test_init_and_vote ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 2 filtered out; finished in 0.08s

2.test_change_and_undo_vote :

test test::test_change_and_undo_vote ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 2 filtered out; finished in 0.05s

3.test_invalid_option :

test test::test_invalid_option - should panic ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 2 filtered out; finished in 0.05s

4.test_too_many_options :

test test::test_too_many_options - should panic ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 5 filtered out; finished in 0.03s

5.test_negative_fee :

test test::test_negative_fee - should panic ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 5 filtered out; finished in 0.03s

6.test_toggle_poll :

test test::test_toggle_poll - should panic ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 5 filtered out; finished in 0.08s

## Working Demo Video :

https://github.com/user-attachments/assets/059b36f5-3a16-4f66-8cee-082f770d2275

## Inter Contract Call :

The inter-contract call in your project happens inside the vote function in the contracts/poll/src/lib.rs file. Specifically, it is located between lines 127 and 139.

-Specified code :
        // --- INTER-CONTRACT CALL: Voting Fee ---
        let fee: i128 = env.storage().instance().get(&DataKey::Fee).unwrap_or(0);
        if fee > 0 {
            // 1. Fetch the Token Contract Address and Admin Address from storage
            let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
            let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();

            // 2. Initialize the standard Soroban Token Client for that token address
            let token_client = soroban_sdk::token::Client::new(&env, &token_addr);

            // 3. ✨ THIS IS THE INTER-CONTRACT CALL ✨ 
            // It invokes the `transfer` function on the Token Contract
            token_client.transfer(&voter, &admin, &fee);
        }


## Successfully Running CI/CD Pipeline :

1. Soroban Contract CI :
<img width="1919" height="847" alt="Screenshot 2026-03-17 123609" src="https://github.com/user-attachments/assets/3a819646-1706-45c5-8ce0-dd409d4351eb" />

2. Frontend CI  :
<img width="1919" height="859" alt="Screenshot 2026-03-17 123629" src="https://github.com/user-attachments/assets/319d4695-d457-4f3b-8869-b304f3333f82" />

therefore, Successfully running 2 jobs.

## Mobile View :

<img width="353" height="760" alt="image" src="https://github.com/user-attachments/assets/cc03d5be-2e9f-4ce8-9517-6a5ed63b951e" />


   



 

