#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, Address, BytesN, Env, Map, String, Vec,
};

use soroban_sdk::contractevent;

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VoteEvent {
    pub voter: Address,
    pub option: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ChangeEvent {
    pub voter: Address,
    pub old_option: u32,
    pub new_option: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UnvoteEvent {
    pub voter: Address,
    pub option: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PollState {
    pub question: String,
    pub options: Vec<String>,
    pub votes: Map<u32, u32>,
    pub admin: Address,
    pub token: Address,
    pub fee: i128,
    pub is_active: bool,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Question,
    Options,
    VoteCount(u32),
    VoterChoice(Address),
    IsInit,
    Admin,
    Token,
    Fee,
    IsActive,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum PollError {
    InvalidOption = 1,
    PollNotInitialized = 2,
    PollAlreadyInitialized = 3,
    InsufficientFunds = 4,
    TooManyOptions = 5,
    PollClosed = 6,
    NegativeFee = 7,
}

const DAY_IN_LEDGERS: u32 = 17280;
const INSTANCE_TTL_THRESHOLD: u32 = 7 * DAY_IN_LEDGERS;
const INSTANCE_TTL_EXTEND: u32 = 30 * DAY_IN_LEDGERS;
const PERSISTENT_TTL_THRESHOLD: u32 = 7 * DAY_IN_LEDGERS;
const PERSISTENT_TTL_EXTEND: u32 = 30 * DAY_IN_LEDGERS;

#[contract]
pub struct PollContract;

#[contractimpl]
impl PollContract {
    pub fn init(
        env: Env,
        admin: Address,
        token: Address,
        fee: i128,
        question: String,
        options: Vec<String>,
    ) -> Result<(), PollError> {
        if options.len() < 2 {
            panic!("At least 2 options required");
        }
        if options.len() > 20 {
            return Err(PollError::TooManyOptions);
        }
        if fee < 0 {
            return Err(PollError::NegativeFee);
        }

        if env.storage().instance().has(&DataKey::IsInit) {
            return Err(PollError::PollAlreadyInitialized);
        }

        env.storage().instance().set(&DataKey::Question, &question);
        env.storage().instance().set(&DataKey::Options, &options);
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::Fee, &fee);

        for i in 0..options.len() {
            env.storage().instance().set(&DataKey::VoteCount(i), &0u32);
        }

        env.storage().instance().set(&DataKey::IsInit, &true);
        env.storage().instance().set(&DataKey::IsActive, &true);
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_TTL_THRESHOLD, INSTANCE_TTL_EXTEND);

        Ok(())
    }

    pub fn vote(env: Env, voter: Address, option_index: u32) -> Result<(), PollError> {
        voter.require_auth();

        let is_init: bool = env
            .storage()
            .instance()
            .get(&DataKey::IsInit)
            .unwrap_or(false);

        if !is_init {
            return Err(PollError::PollNotInitialized);
        }

        let is_active: bool = env.storage().instance().get(&DataKey::IsActive).unwrap_or(true);
        if !is_active {
            return Err(PollError::PollClosed);
        }

        let options: Vec<String> = env.storage().instance().get(&DataKey::Options).unwrap();
        if option_index >= options.len() {
            return Err(PollError::InvalidOption);
        }

        // --- INTER-CONTRACT CALL: Voting Fee ---
        let fee: i128 = env.storage().instance().get(&DataKey::Fee).unwrap_or(0);
        if fee > 0 {
            let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
            let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();

            // Standard Soroban Token Client call
            let token_client = soroban_sdk::token::Client::new(&env, &token_addr);

            // This is the cross-contract call
            token_client.transfer(&voter, &admin, &fee);
        }
        // ----------------------------------------

        env.storage()
            .instance()
            .extend_ttl(INSTANCE_TTL_THRESHOLD, INSTANCE_TTL_EXTEND);

        let voter_key = DataKey::VoterChoice(voter.clone());
        let maybe_existing_choice: Option<u32> = env.storage().persistent().get(&voter_key);

        match maybe_existing_choice {
            Some(old_index) => {
                if old_index == option_index {
                    Self::update_vote_count(&env, old_index, false);
                    env.storage().persistent().remove(&voter_key);
                    
                    UnvoteEvent {
                        voter,
                        option: option_index,
                    }
                    .publish(&env);
                } else {
                    Self::update_vote_count(&env, old_index, false);
                    Self::update_vote_count(&env, option_index, true);

                    env.storage().persistent().set(&voter_key, &option_index);
                    env.storage().persistent().extend_ttl(
                        &voter_key,
                        PERSISTENT_TTL_THRESHOLD,
                        PERSISTENT_TTL_EXTEND,
                    );

                    ChangeEvent {
                        voter,
                        old_option: old_index,
                        new_option: option_index,
                    }
                    .publish(&env);
                }
            }
            None => {
                Self::update_vote_count(&env, option_index, true);

                env.storage().persistent().set(&voter_key, &option_index);
                env.storage().persistent().extend_ttl(
                    &voter_key,
                    PERSISTENT_TTL_THRESHOLD,
                    PERSISTENT_TTL_EXTEND,
                );

                VoteEvent {
                    voter,
                    option: option_index,
                }
                .publish(&env);
            }
        }

        Ok(())
    }

    fn update_vote_count(env: &Env, index: u32, increment: bool) {
        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::VoteCount(index))
            .unwrap_or(0);

        if increment {
            env.storage()
                .instance()
                .set(&DataKey::VoteCount(index), &(count + 1));
        } else if count > 0 {
            env.storage()
                .instance()
                .set(&DataKey::VoteCount(index), &(count - 1));
        }
    }

    pub fn get_poll_state(env: Env) -> PollState {
        let question = env
            .storage()
            .instance()
            .get(&DataKey::Question)
            .unwrap_or(String::from_str(&env, ""));
        let options: Vec<String> = env
            .storage()
            .instance()
            .get(&DataKey::Options)
            .unwrap_or(Vec::new(&env));

        let mut votes: Map<u32, u32> = Map::new(&env);
        for i in 0..options.len() {
            let count = env
                .storage()
                .instance()
                .get(&DataKey::VoteCount(i))
                .unwrap_or(0);
            votes.set(i, count);
        }

        let admin = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or(Address::from_string(&String::from_str(
                &env,
                "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
            ))); // Default dummy
        let token = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .unwrap_or(Address::from_string(&String::from_str(
                &env,
                "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
            )));
        let fee = env.storage().instance().get(&DataKey::Fee).unwrap_or(0);
        let is_active = env.storage().instance().get(&DataKey::IsActive).unwrap_or(true);

        PollState {
            question,
            options,
            votes,
            admin,
            token,
            fee,
            is_active,
        }
    }

    pub fn has_voted(env: Env, voter: Address) -> bool {
        env.storage().persistent().has(&DataKey::VoterChoice(voter))
    }

    pub fn get_voter_choice(env: Env, voter: Address) -> Option<u32> {
        env.storage().persistent().get(&DataKey::VoterChoice(voter))
    }

    pub fn toggle_poll(env: Env) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let is_active: bool = env.storage().instance().get(&DataKey::IsActive).unwrap_or(true);
        env.storage().instance().set(&DataKey::IsActive, &!is_active);
    }

    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }
}

#[cfg(test)]
mod test;
