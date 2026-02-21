#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, contracttype, symbol_short, vec, Env, Symbol, Vec, Address, Map, String};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PollState {
    pub question: String,
    pub options: Vec<String>,
    pub votes: Map<u32, u32>,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Question,
    Options,
    VoteCount(u32),
    VoterChoice(Address),
    IsInit,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum PollError {
    InvalidOption = 1,
    PollNotInitialized = 2,
    PollAlreadyInitialized = 3,
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

    pub fn init(env: Env, question: String, options: Vec<String>) -> Result<(), PollError> {
        if options.len() < 2 {
            panic!("At least 2 options required");
        }

        if env.storage().instance().has(&DataKey::IsInit) {
            return Err(PollError::PollAlreadyInitialized);
        }

        env.storage().instance().set(&DataKey::Question, &question);
        env.storage().instance().set(&DataKey::Options, &options);

        for i in 0..options.len() {
            env.storage().instance().set(&DataKey::VoteCount(i), &0u32);
        }

        env.storage().instance().set(&DataKey::IsInit, &true);
        env.storage().instance().extend_ttl(INSTANCE_TTL_THRESHOLD, INSTANCE_TTL_EXTEND);

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

        let options: Vec<String> = env.storage().instance().get(&DataKey::Options).unwrap();
        if option_index >= options.len() {
            return Err(PollError::InvalidOption);
        }

        env.storage().instance().extend_ttl(INSTANCE_TTL_THRESHOLD, INSTANCE_TTL_EXTEND);

        let voter_key = DataKey::VoterChoice(voter.clone());
        let maybe_existing_choice: Option<u32> = env.storage().persistent().get(&voter_key);

        match maybe_existing_choice {
            Some(old_index) => {
                if old_index == option_index {
                    Self::update_vote_count(&env, old_index, false);
                    env.storage().persistent().remove(&voter_key);
                    env.events().publish(
                        (symbol_short!("poll"), symbol_short!("unvote")),
                        (voter, old_index),
                    );
                } else {
                    Self::update_vote_count(&env, old_index, false);
                    Self::update_vote_count(&env, option_index, true);

                    env.storage().persistent().set(&voter_key, &option_index);
                    env.storage().persistent().extend_ttl(
                        &voter_key,
                        PERSISTENT_TTL_THRESHOLD,
                        PERSISTENT_TTL_EXTEND,
                    );

                    env.events().publish(
                        (symbol_short!("poll"), symbol_short!("change")),
                        (voter, old_index, option_index),
                    );
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

                env.events().publish(
                    (symbol_short!("poll"), symbol_short!("vote")),
                    (voter, option_index),
                );
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
            let count = env.storage().instance()
                .get(&DataKey::VoteCount(i))
                .unwrap_or(0);
            votes.set(i, count);
        }

        PollState {
            question,
            options,
            votes,
        }
    }
   
    pub fn has_voted(env: Env, voter: Address) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::VoterChoice(voter))
    }
  
    pub fn get_voter_choice(env: Env, voter: Address) -> Option<u32> {
        env.storage()
            .persistent()
            .get(&DataKey::VoterChoice(voter))
    }
}
mod test;