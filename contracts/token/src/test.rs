#![cfg(test)]

use super::*;
use soroban_sdk::{Env, testutils::Address as _, String};

#[test]
fn test_token() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    let contract_id = env.register_contract(None, Token);
    let client = TokenClient::new(&env, &contract_id);

    let name = String::from_str(&env, "PollToken");
    let symbol = String::from_str(&env, "POLL");
    
    client.initialize(&admin, &18, &name, &symbol);

    assert_eq!(client.name(), name);
    assert_eq!(client.symbol(), symbol);
    assert_eq!(client.decimals(), 18);

    client.mint(&user1, &1000);
    assert_eq!(client.balance(&user1), 1000);

    client.transfer(&user1, &user2, &400);
    assert_eq!(client.balance(&user1), 600);
    assert_eq!(client.balance(&user2), 400);
}
