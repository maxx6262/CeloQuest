// SPDX-License-Identifier: MIT

pragma solidity >=0.7.0 <0.9.0;

/**
 * @title CeloQuest
 * @author M.LECOUSTE
 * @notice - Get answer, information or contributions by community
 *      - Get Reward by helping to solve Quests
 * @dev - Users can make payable Quests to get contributions collection
 *  Users can vote for most usable content only once per quest when they contribute
 *  Most usable contents are rewardables
*/

//IERC20 Interface to get cUsd contract functions
interface IERC20Token {
    function transfer(address, uint256) external returns (bool);
    function approve(address, uint256) external returns (bool);
    function transferFrom(address, address, uint256) external returns (bool);
    function totalSupply() external view returns (uint256);
    function balanceOf(address) external view returns (uint256);
    function allowance(address, address) external view returns (uint256);

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

contract Celoquest {
    uint    internal            nbQuests            =   0;
    uint    internal            nbContributions     =   0;
    uint    internal            nbUsers             =   0;
    address internal            cUsdTokenAddress    = 0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1;

    address payable internal    owner;

    //****************************************************************************************************/
    //Constructor
    /** * @dev Contract is ownable - Owner can withdraw rewards amount locked to winner or
        *   back to quest's creators
        *   => QuestToken will become full ERC20 token users could withdraw on their wallet
    */
    constructor() {
        owner   =   payable(msg.sender);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform it");
        _;
    }

    function getOwner() public view returns(address payable) {
        return owner;
    }

    function _setNewOwner(address payable _newOwnerAddress) external onlyOwner {
        owner   =   _newOwnerAddress;
    }

    function _withdrawQuestToken(address _to, uint _amount) external onlyOwner {
        require(tokenBalance[address(this)] >= _amount, "Contract QuestToken too low");
        tokenBalance[address(this)] -= _amount;
        tokenBalance[_to] += _amount;
        emit NewQuestTokenTransfer(address(this), _to, _amount);
    }

    function _sendCUsdToken(address payable _to, uint _amount) internal onlyOwner {
        require(IERC20Token(cUsdTokenAddress).balanceOf(address(this)) >= _amount,
            "Contract cUSD balance too low");
        IERC20Token(cUsdTokenAddress).transfer(_to, _amount);
    }

    function _sendCUsdTokenToContract(address _from, uint _amount) public payable returns(bool) {
        require(IERC20Token(cUsdTokenAddress).balanceOf(_from) >= _amount,
            "Sender cUSD balance too low !");
        require(IERC20Token(cUsdTokenAddress).transferFrom(_from, payable(address(this)), _amount),
            "Transfer failed");
        return true;
    }

    function contractCUsdBalance() public view returns(uint) {
        return(IERC20Token(cUsdTokenAddress).balanceOf(address(this)));
    }

    function contractCQTBalance() public view returns(uint) {
        return(contractBalance);
    }

    function cqtCurrentSupply() public view returns(uint) {
        return(currentSupply);
    }

    function cqtMaxSupply() public view returns(uint) {
        return(maxTokenSupply);
    }

    function _setNewInitialQuestTokenBalance(uint _newAmount) external onlyOwner {
        require(_newAmount >= 0, "new initial amount has to be > 0");
        initialUserTokenBalance = _newAmount;
    }

    //****************************************************************************************************/
    //QuestToken
    /** * @dev For the moment, QuestToken is just inner contract value
        *   with maximum mintable amount and transferrable balances
        *   => Initial Distribution can only be maked once per Wallet address
        *       when address records pseudo
    */

    uint    internal            maxTokenSupply  =   10000000;
    uint    internal            currentSupply   =   0;
    uint    internal            contractBalance =   0;

    uint    internal            initialUserTokenBalance =   150;

    mapping(address => uint)    tokenBalance;

    event NewQuestTokenTransfer(address from, address to, uint amount);

    function questTokenBalanceOf(address _userAddress) public view returns(uint) {
        return tokenBalance[_userAddress];
    }

    function _mintToken(address _to, uint _amount) internal {
        require(currentSupply + _amount <= maxTokenSupply, "Maximum Token supply reached");
        tokenBalance[_to] +=    _amount;
        currentSupply     +=    _amount;
        emit NewQuestTokenTransfer(address(0), _to, _amount);
    }

    function _transferQuestTokenTo(address _to, uint _amount) internal {
        require(contractBalance >= _amount, "Contract QuestToken Balance too low");
        tokenBalance[_to] += _amount;
        contractBalance   -= _amount;
        emit NewQuestTokenTransfer(address(this), _to, _amount);
    }

    function _transferQuestTokenFrom(address _from, address _to, uint _amount) internal {
        require(tokenBalance[_from] >= _amount, "Sender questToken Balance too low");
        tokenBalance[_to]   += _amount;
        tokenBalance[_from] -= _amount;
        emit NewQuestTokenTransfer(_from, _to, _amount);
    }

    function transferQuestToken(address _from, address _to, uint _amount) external {
        require(_amount >= 0, "Amount can't be lower than 0");
        require(tokenBalance[_from] >= _amount, "QuestToken Balance too low");
        tokenBalance[_to] += _amount;
        tokenBalance[_from] -= _amount;
        emit NewQuestTokenTransfer(_from, _to, _amount);
    }

    //****************************************************************************************************/
    //Users pseudos
    mapping(address => string)      userPseudo;
    mapping(address => uint)        userQuestsCount;
    mapping(address => uint)        userContributionsCount;


    modifier onlyUser(address _userAddress) {
        require(bytes(userPseudo[_userAddress]).length > 0, "User not found");
        _;
    }

    function getNbUsers() public view returns(uint) {
        return nbUsers;
    }

    /** * @param _newPseudo : User pseudo
        * @dev User can choose a pseudo to display on Platform
        *   => if newUser : get NewUserInitialBalance
    */
    function setPseudo(string memory _newPseudo) external {
        require(bytes(_newPseudo).length > 0, "Pseudo can't be empty");
        bytes memory _userStoredPseudoBytes = bytes(userPseudo[msg.sender]);
        if (_userStoredPseudoBytes.length == 0) {
            //isNewUser => mint InitialUserTokenBalance
            _mintToken(msg.sender, initialUserTokenBalance);
            nbUsers++;
        }
        userPseudo[msg.sender] = _newPseudo;
    }

    /** * @param _userAddress : address to find from active users
        * @dev Return user's stored data from _address
    */
    function readUser(address _userAddress) public view returns(
        string memory,          //pseudo
        uint,                   //nbQuests
        uint,                   //nbContribs
        uint,                   //questTokenBalance
        uint                    //cUsdBalance
    ) {
        require(bytes(userPseudo[_userAddress]).length > 0, "User not founc");
        return (
        userPseudo[_userAddress],
        userQuestsCount[_userAddress],
        userContributionsCount[_userAddress],
        tokenBalance[_userAddress],
        IERC20Token(cUsdTokenAddress).balanceOf(_userAddress)
        );
    }

    /** * @param _userAddress : Address to read
        * @dev get User pseudo
    */
    function getPseudo(address _userAddress) public view returns(string memory) {
        return userPseudo[_userAddress];
    }

    //****************************************************************************************************/
    //Contribution Struct
    /** * @dev Contribution is ownable.
        *   Only one contribution on each Quest per Address
    */
    struct  Contribution {
        uint                questId;
        address payable     owner;
        string              title;
        string              content;
        uint                nbVotes;
    }

    mapping(uint => Contribution) contributions;

    event NewContribution(uint questId, address payable owner, uint contributionId);

    function getNbContributions() public view returns(uint) {
        return nbContributions;
    }

    /** * @param _contributionId : id of contribution
        * @dev Return Contribution data
    */
    function readContribution(uint _contributionId) public view returns(
        uint,            //QuestId
        address payable, //Contribution owner
        string memory,   //Contribution title
        string memory,   //Contribution content
        uint            //nbVotes
    ) {
        require(_contributionId < nbContributions, "Contribution not found");
        return(
        contributions[_contributionId].questId,
        contributions[_contributionId].owner,
        contributions[_contributionId].title,
        contributions[_contributionId].content,
        contributions[_contributionId].nbVotes
        );
    }

    function getContributionTitle(uint _contributionId) public view returns(string memory) {
        require(_contributionId < nbContributions, "Contribution not found");
        return contributions[_contributionId].title;
    }

    //**********************************************************************************************************/
    //Quest Struct

    /** * @dev Quest is funded at creation by owner
        *   Quest is builded with deadline - noone could contribute after deadline
        *   Quest has contribution mapping (one contribution per User)
        *   Quest has vote mapping (each user can vote for best contribution)
        *       Vote period ends at deadline + 1 day
    */
    struct Quest {
        address                             owner;
        string                              title;
        string                              content;
        bool                                isActive;
        //      uint                                deadLine;
        uint                                cUsdReward;
        uint                                tokenReward;
        uint                                nbContributions;
        uint                                nbVotes;
        mapping(uint => uint)               contributions;
        mapping(address => uint)            userContribution;
        mapping(address => uint)            userVote;
    }

    mapping(uint => Quest) quests;
    mapping(uint => bool)  questRewardPaid;

    event NewQuest(address owner, string title, uint cUsdReward, uint questTokenReward);
    event NewVote(uint questId, uint contributionId, address userAddress);
    event NewRewardPayment(address payable winnerAddress, uint questId, uint questTokenAmount, uint cUsdAmount);

    function getNbQuests() public view returns(uint) {
        return nbQuests;
    }

    /** * @param _questId : id of Quest
        * @dev Return pseudo of quest owner
    */
    function getQuestOwnerPseudo(uint _questId) public view returns(string memory) {
        require(_questId < nbQuests, "Quest not found");
        return userPseudo[quests[_questId].owner];
    }

    /** * @param _questId : id of quest
        * @dev return nb of contributions for this Quest
    */
    function getQuestNbContribs(uint _questId) public view returns(uint) {
        require(_questId <= nbQuests, "Quest not found");
        return quests[_questId].nbContributions;
    }

    /** * @param _questId: id of quest
        * @dev return title of Quest
    */
    function getQuestTitle(uint _questId) public view returns(string memory) {
        require(_questId <= nbQuests, "Quest not found");
        return (quests[_questId].title);
    }

    /** * @param _questId:  id of Quest
        * @param _contribInternalId Quest internal contribID
        * @dev return public contribId from Quest internal id of contribID
    */
    function getContribId(uint _questId, uint _contribInternalId) public view returns(uint) {
        require(_questId < nbQuests, "Quest not found");
        require(_contribInternalId < quests[_questId].nbContributions, "Contribution not found");
        return quests[_questId].contributions[_contribInternalId];
    }
    //=> Deleting nbActiveDays : quest owner decide when ending quest
    /** * @param _content is Quest explanation/description
        * @param _cUsdReward  is cUsd reward amount Quest's owner will pay to winner
        * @param _questTokenReward is QuestToken reward amount Quest's owner will pay to winner
        * @dev   owner create Quest with Rewards = _cUsdAmount of cUsd token and _questTokenAmount of questToken
        *           - Users can contribute until deadline
        *           - Users can vote until deadline + 1 day
    */
    function createQuest(string memory _title, string memory _content, uint _cUsdReward, uint _questTokenReward)
    external {
        require(bytes(_content).length > 0, "Quest content can't be empty");
        require(_cUsdReward + _questTokenReward > 0, "Quest must have reward amount");
        require(tokenBalance[msg.sender] >= _questTokenReward, "QuestToken balance too low");
        if (_cUsdReward > 0) {
            require(IERC20Token(cUsdTokenAddress).transferFrom(msg.sender, payable(address(this)), _cUsdReward) ,
                "Error during cUsd transaction");
        }
        if (_questTokenReward > 0) {
            _transferQuestTokenFrom(msg.sender, address(this), _questTokenReward);
            contractBalance+= _questTokenReward;
        }
        Quest storage _newQuest     =   quests[nbQuests];
        _newQuest.title             =   _title;
        _newQuest.owner             =   msg.sender;
        _newQuest.content           =   _content;
        _newQuest.cUsdReward        =   _cUsdReward;
        _newQuest.tokenReward       =   _questTokenReward;
        _newQuest.isActive          =   true;
        _newQuest.nbVotes           =   0;
        _newQuest.nbContributions   =   0;
        userQuestsCount[msg.sender]++;
        emit NewQuest(msg.sender, _content, _cUsdReward, _questTokenReward);
        nbQuests++;
    }


    //Get all Quest data
    function readQuest(uint _questId) public view returns (
        address,            //Quest's owner
        string memory,      //Quest's title
        string memory,      //Quest content
        uint,               //cUsd Reward amount
        uint,               //questToken Reward amount
        uint,               //Quest Contributions Count
        bool                //Quest is active
    ) {
        return (
        quests[_questId].owner,
        quests[_questId].title,
        quests[_questId].content,
        quests[_questId].cUsdReward,
        quests[_questId].tokenReward,
        quests[_questId].nbContributions,
        quests[_questId].isActive
        );
    }

    /**     Deleting deadline process
        function isActiveQuest(uint _questId) public view returns(bool) {
            return (quests[_questId].deadLine + (1 days) > block.timestamp);
        }
    */
    //Modifier isActive => only active quest we can still contribute
    modifier isActive(uint _questId) {
        require(_questId < nbQuests, "Quest not found");
        require(quests[_questId].isActive, "Quest not active");
        _;
    }


    //****************************************************************************************************/
    //test past Contribution existence
    /** * @param _questId ID of Quest to test
        * @return true if contribution from sender for quest found
        * @dev Test existence of sender's past contribution
    */
    function hasContribute(uint _questId, address _sender) public view onlyUser(_sender) returns(bool) {
        require(_questId < nbQuests, "Quest not found");
        return(quests[_questId].userContribution[msg.sender] > 0 );
    }

    //****************************************************************************************************/
    //test user already gived vote in Quest
    /** * @param _questId ID of quest
        * @return bool true if user has maked vote
        * @dev User can vote only once per quest
    */
    function hasVote(uint _questId, address _sender) public view returns(bool) {
        require(_questId < nbQuests, "Quest not found");
        return(quests[_questId].userVote[_sender] > 0);
    }


    //****************************************************************************************************/
    //Post contribution
    /** * @param _questId  ID of Quest user would contribute
        * @param _content  content of contribution
        * @dev Only one contribution per address until deadline is reached
    */
    function createContribution(uint _questId, string memory _title, string memory _content)
    external onlyUser(msg.sender) isActive(_questId) {
        require(!(hasContribute(_questId, msg.sender)), "User already contribute to Quest");
        contributions[nbContributions] = Contribution(
            _questId,
            payable(msg.sender),
            _title,
            _content,
            0);
        quests[_questId].contributions[quests[_questId].nbContributions] = nbContributions;
        quests[_questId].userContribution[msg.sender] = nbContributions;
        quests[_questId].nbContributions++;
        userContributionsCount[msg.sender]++;
        nbContributions++;
    }
    /** * @param _contributionId : Contribution user is voting for
        * @dev store newVote on chain (each active user can vote once per quest he contributed on
    */
    function newVote(uint _contributionId) external onlyUser(msg.sender) isActive(contributions[_contributionId].questId)
    {
        require(_contributionId < nbContributions, "Contribution not found");
        require(!(contributions[_contributionId].owner == msg.sender),
            "User can't vote his owned contributions");
        uint _questId = contributions[_contributionId].questId;
        if (!(quests[_questId].userVote[msg.sender] > 0)) {
            quests[_questId].nbVotes++;
        } else {
            contributions[quests[_questId].userVote[msg.sender]].nbVotes--;
        }
        quests[_questId].userVote[msg.sender] = _contributionId;
        contributions[_contributionId].nbVotes++;
        emit NewVote(_questId, _contributionId, msg.sender);
    }

    /** * @param _contribId : Contrib quest's owner want to reward
          @dev By setting winner, quest's owner disable quest and lauch rewards transactions
    */
    function setWinner(uint _contribId) external onlyUser(msg.sender) isActive(contributions[_contribId].questId) {
        require(quests[contributions[_contribId].questId].owner == msg.sender, "Only quest owner can set winner");
        Contribution memory _contrib = contributions[_contribId];
        Quest storage _quest = quests[_contrib.questId];
        _transferQuestTokenTo(
            _contrib.owner,
            _quest.tokenReward
        );
        if (_quest.cUsdReward > 0) {
            _sendCUsdToken(
                _contrib.owner,
                _quest.cUsdReward
            );
        }
        if (_quest.nbVotes > 0) {
            closeQuest(_quest);
        }
        _quest.isActive = false;
    }

    /** * @param _quest : quest to close
        * @dev End of quest = main Reward distribution + bonus Reward calculate with vote system
    */
    function closeQuest(Quest storage _quest) internal {
        uint _cqtReward = _quest.tokenReward + (_quest.cUsdReward * 10);
        uint voteValue  = _cqtReward / _quest.nbVotes;
        for (uint i = 0 ; i < _quest.nbContributions ; i++) {
            Contribution memory _contrib = contributions[_quest.contributions[i]];
            if (_contrib.nbVotes > 0) {
                _mintToken(_contrib.owner, _contrib.nbVotes * voteValue);
            }
        }
        _quest.isActive = false;
    }
}