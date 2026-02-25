#![cfg(test)]

use super::*;
use soroban_sdk::{Env, testutils::{Address as _, Events}, vec, symbol_short};

#[test]
fn test_init_and_vote() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, PollContract);
    let client = PollContractClient::new(&env, &contract_id);

    let question = String::from_str(&env, "Favorite Color?");
    let options = vec![&env, String::from_str(&env, "Red"), String::from_str(&env, "Blue")];

    client.init(&question, &options);

    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);

    client.vote(&voter1, &0);
    
    client.vote(&voter2, &1);

    let state = client.get_poll_state();
    assert_eq!(state.question, question);
    assert_eq!(state.options, options);
    assert_eq!(state.votes.get(0).unwrap(), 1);
    assert_eq!(state.votes.get(1).unwrap(), 1);
}

#[test]
fn test_change_and_undo_vote() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, PollContract);
    let client = PollContractClient::new(&env, &contract_id);

    let question = String::from_str(&env, "Q?");
    let options = vec![&env, String::from_str(&env, "A"), String::from_str(&env, "B")];
    client.init(&question, &options);

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

    let question = String::from_str(&env, "Q?");
    let options = vec![&env, String::from_str(&env, "A"), String::from_str(&env, "B")];

    client.init(&question, &options);

    let voter = Address::generate(&env);
    client.vote(&voter, &2); 
}
