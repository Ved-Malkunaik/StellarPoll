use super::*;
use soroban_sdk::{testutils::Address as _, vec, Env, String};

#[test]
fn test_init_and_vote() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let fee: i128 = 100;

    let contract_id = env.register(PollContract, ());
    let client = PollContractClient::new(&env, &contract_id);

    let question = String::from_str(&env, "Favorite Color?");
    let options = vec![
        &env,
        String::from_str(&env, "Red"),
        String::from_str(&env, "Blue"),
    ];

    client.init(&admin, &token, &fee, &question, &options);

    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);

    // Mint some tokens to voters so they can pay the fee
    let token_client = soroban_sdk::token::StellarAssetClient::new(&env, &token);
    token_client.mint(&voter1, &1000);
    token_client.mint(&voter2, &1000);

    client.vote(&voter1, &0);
    client.vote(&voter2, &1);

    let state = client.get_poll_state();
    assert_eq!(state.question, question);
    assert_eq!(state.options, options);
    assert_eq!(state.votes.get(0).unwrap(), 1);
    assert_eq!(state.votes.get(1).unwrap(), 1);

    // Verify fee was transferred to admin
    let token_final_client = soroban_sdk::token::Client::new(&env, &token);
    assert_eq!(token_final_client.balance(&admin), 200);
}

#[test]
fn test_change_and_undo_vote() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PollContract, ());
    let client = PollContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let token = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();

    let question = String::from_str(&env, "Q?");
    let options = vec![
        &env,
        String::from_str(&env, "A"),
        String::from_str(&env, "B"),
    ];
    client.init(&admin, &token, &0, &question, &options);

    let voter = Address::generate(&env);

    client.vote(&voter, &0);
    assert_eq!(client.get_poll_state().votes.get(0).unwrap(), 1);
    assert_eq!(client.get_voter_choice(&voter), Some(0));

    client.vote(&voter, &1);
    assert_eq!(client.get_poll_state().votes.get(0).unwrap(), 0);
    assert_eq!(client.get_poll_state().votes.get(1).unwrap(), 1);
    assert_eq!(client.get_voter_choice(&voter), Some(1));

    client.vote(&voter, &1);
    assert_eq!(client.get_poll_state().votes.get(1).unwrap(), 0);
    assert_eq!(client.get_voter_choice(&voter), None);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn test_invalid_option() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PollContract, ());
    let client = PollContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();

    let question = String::from_str(&env, "Q?");
    let options = vec![
        &env,
        String::from_str(&env, "A"),
        String::from_str(&env, "B"),
    ];

    client.init(&admin, &token, &0, &question, &options);

    let voter = Address::generate(&env);
    client.vote(&voter, &2);
}
