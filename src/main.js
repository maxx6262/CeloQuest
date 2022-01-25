import Web3 from 'web3'
import { newKitFromWeb3 } from '@celo/contractkit'
import CeloquestAbi from '../contract/Celoquest.abi.json'
import BigNumber from "bignumber.js";

const ERC20_DECIMALS = 18

    //Contract address on Celo Testnet Chain
const celoquestContractAddress = "0xC46eD808Cd90a49f148b523b7eF51fB3ACFC0730"
var nbQuests
var kit
var contract
var user = {}
var quests = []
var contributions = []
var quest = {}
var nbContribs
var nbContributions
var questId
//***********************************************************************************************

    //Connec Web3 wallet to the chain
const connectCeloWallet = async function () {
    if (window.celo) {
        notification("⚠️ Please approve this DApp to use it.")
        try {
            await window.celo.enable()
            notificationOff()

            const web3 = new Web3(window.celo)
            kit = newKitFromWeb3(web3)

            const accounts = await kit.web3.eth.getAccounts()
            kit.defaultAccount = accounts[0]

            contract = new web3.eth.Contract(CeloquestAbi, celoquestContractAddress)
            nbQuests = await contract.methods.getNbQuests().call()
            nbContributions = await contract.methods.getNbContributions().call()
        } catch (error) {
            notification(`⚠️ ${error}.`)
        }
    } else {
        notification("⚠️ Please install the CeloExtensionWallet.")
    }
}
//*****************************************************************************************************

    //User management

const getUser = async function() {
    let pseudo
    try {
        const _user = await contract.methods.readUser(kit.defaultAccount).call()
        pseudo = _user[0]
    } catch (error) {
        notification(error)
        pseudo = ""
    }
    document.querySelector("#UserBlock").innerHTML = userTemplate(kit.defaultAccount, pseudo)
}


        //Get Pseudo from address
const getPseudo = async function (_address) {
    let pseudo = await contract.methods.getPseudo(_address).call()
    if (pseudo.trim === "") {
        pseudo = "Click to create account"
    }
    return pseudo
}

        //Display address badge
function identiconTemplate(_address) {
    const icon = blockies
        .create({
            seed: _address,
            size: 8,
            scale: 16,
        })
        .toDataURL()
    return `
  <div class="rounded-circle overflow-hidden d-inline-block border border-white border-2 shadow-sm m-0">
    <a href="https://alfajores-blockscout.celo-testnet.org/address/${_address}/transactions"
        target="_blank">
        <img src="${icon}" width="48" alt="${_address}">
    </a>
  </div>
  `
}
        //User block template
const userTemplate = function(_address, _pseudo) {
    if (_pseudo.trim() === "") {
        _pseudo =   "Unknown address"
    }
    return `<span id="user">
            ${identiconTemplate(_address)}
            <a  class="btn rounded-pill"
                data-bs-toggle="modal"
                href="#pseudoModal">
                ${_pseudo}
            </a>
            </span>`
}
        //Balance of user Wallet
const getBalance = async function() {
    const totalBalance = await kit.getTotalBalance(kit.defaultAccount)
    const cUSDBalance  = totalBalance.cUSD.shiftedBy(-ERC20_DECIMALS).toFixed(2)
    const CQTBalance   = await contract.methods.questTokenBalanceOf(kit.defaultAccount).call()
    document.querySelector("#cUsdBalance").textContent  = cUSDBalance
    document.querySelector("#CqtBalance").textContent   = CQTBalance
}


//*******************************************************************************************
    //Quests management


const setQuestId = async function (_questId) {
    console.log(_questId)
    console.log(nbQuests)
    console.log(_questId < nbQuests)
    console.log(quests)
    questId = parseInt(_questId)
    try {
        notification("Loading quest")
        if (questId < nbQuests) {
            quest = quests[questId]
            console.log(quest.title)
            if (parseInt(quest.id) != parseInt(questId)) {
                const result  = await contract.methods.readQuest(questId).call()
                const _pseudo = await contract.methods.getPseudo(result[0]).call()
                quest = {
                    id:                 parseInt(_questId),
                    owner:              result[0],
                    pseudo:             _pseudo,
                    title:              result[1],
                    content:            result[2],
                    cUsdReward:         result[3],
                    cqtReward:          result[4],
                    nbContributions:    result[5],
                    isActive:           result[6],
                }
                quests[questId] = quest
            }
        }
        console.log(quest)
        notificationOff()
    } catch (error) {
        notification(error)
    }
}

        //Setting current focused Quest ID
const setQuestIdOnContribModal = async function (_questId) {
    console.log(_questId)
    document.querySelector('#newContribModal').querySelector("#questId").innerHTML = _questId
    await setQuestId(_questId)
}

        //Get all active Quests
const getAllQuests  = async function() {
    quests = []
    try {
        notification("Loading " + nbQuests + " stored quests")
        for (let i = 0 ; i < nbQuests ; i++) {
            let _pseudo = await contract.methods.getQuestOwnerPseudo(i).call()
            let p = await contract.methods.readQuest(i).call()
            let _quest = {
                id:                 i,
                owner:              p[0],
                pseudo:             _pseudo,
                title:              p[1],
                content:            p[2],
                cUsdReward:         p[3],
                cqtReward:          p[4],
                nbContributions:    p[5],
                isActive:           p[6],
            }
            console.log(_quest)
            quests.push(_quest)
        }
        console.log(quests)
        await renderQuestsList()
        notificationOff()
    } catch (error) {
        notification(`⚠️ ${error}.`)
    }
}

        //Template to display Quest on Dasboard list
async function questTemplate(_quest) {
    let rep =
        `<div class="card mb-4">
            <div class="card-body text-left p-4 position-relative">
                <div class="translate-middle-y position-absolute top-0">
                    ${identiconTemplate(_quest.owner)}
                </div>
                <h2 class="card-title fs-4 fw-bold mt-2">${_quest.title}</h2>
                <br>
                <h3 class="card-tile fs-4 fw-bold mt-1">${_quest.pseudo}</h3>
                <p class="card-text mb-4" style="min-height: 82px">
                    ${_quest.content}             
                </p>
                <div class="d-grid gap-2">
                    <div class="position-absolute top-0 end-0 bg-warning mt-4 px-2 py-1 rounded-start">
                    </div> `
    let _hasContribute = await contract.methods.hasContribute(_quest.id, kit.defaultAccount).call()
    if (_quest.isActive && !(_hasContribute)) {
        rep +=
                   `<a class="btn btn-lg btn-outline-dark contributionBtn fs-6 p-3" 
                       data-bs-toggle="modal"
                       data-bs-target="#newContribModal"
                       onclick="setQuestOnNewContribModal(${_quest.id})"
                    > 
                        <div id="questId" style="display: none"> ${_quest.id} </div>
                            Contribute to get ${_quest.cUsdReward} cUSD
                            and ${_quest.cqtReward} CQT
                    </a>`
    }
    else {
        rep +=
                   `<a class="btn btn-lg btn-outline-dark fs-6 p-3" id="seeContribBtn"
                    >   
                        <div id="questId" style="display: none"> ${_quest.id} </div>
                        See ${_quest.nbContributions} contributions 
                    </a> 
                    <p>
                        Reward = <strong> ${_quest.cUsdReward} cUSD </strong>
                        and  <strong> ${_quest.cqtReward} CQT </strong>
                    </p>`
    }
    rep +=
                `</div>
             </div>
         </div>`
   return rep
}

const storeQuest = async function (_newQuest) {
    try {
        notification("Adding New Quest")
        await contract.methods.createQuest(
            _newQuest.title,
            _newQuest.content,
            _newQuest.cUsdReward,
            _newQuest.cqtReward
        ).send({from: _newQuest.owner})
        notification("New Quest stored on chain")
        await getBalance()
    } catch (error) {
        notification(`⚠️ ${error}.`)
    }
}


//***********************************************************************************************
        //Contributions management

        //Vote on contrib
const voteContrib = async function (_contribId) {
    try {
        notification("Adding new Vote on Chain")
        const result = await contract.methods.newVote(_contribId)
            .send({from: kit.defaultAccount})
            .then(notificationOff)
    } catch (error) {
        notification(`⚠️ ${error}.`)
    }
}


const questHeaderTemplate = function (_questId) {
    try {
        if  (questId != _questId) {
            notification('Loading Quest Header')
            loadQuest(_questId)
            notificationOff()
        }
        return (
            `<div class="class="container my-4"> 
                <br>
                <h1> Contribution's list </h1>
                <button class="btn btn-dark"
                        id="questListBtn"
                >
                    Back to Quests listing
                </button>
            
                <div class="questHeader" id="questHeader">
                    <div class="translate-middle-y position-absolute top-0">
                        ${identiconTemplate(quest.owner)}
                    </div>
                    <h2> ${quest.title} </h2>
                    <h3> ${quest.content} </h3>
                    <p>
                        List of ${quest.nbContributions} 
                    </p>
                </div>
                <br>
            </div>`)
    } catch (error) {
        notification(`⚠️ ${error}.`)
    }
}



function contribTemplate(_contrib) {
    return `<div class="card mb4 contrib contribCard">
                <div class="card-body text-left p-4 position-relative">
                    <div class="translate-middle-y position-absolute top-0">
                        ${identiconTemplate(_contrib.owner)}    
                    </div>
                    <h2 class="card-title fs-4 fw-bold mt-2"> ${_contrib.pseudo} </h2>
                    <div id="contribId"> ${_contrib.id}</div>
                    <p class="card-text mb-4" style="min-height: 82px">
                        ${_contrib.content}             
                    </p>    
                    <div class="position-absolute top-0 end-0 bg-warning mt-4 px-2 py-1 rounded-start">
                    </div>
                    <button class=btn btn-dark voteBtn"
                           onclick='voteContrib(${_contrib.id})'
                    > 
                        Vote 
                    </button>
                                
                    <div class="btn btn-lg btn-outline-dark contributionBtn fs-6 p-3"
                        <strong> <span datatype="int"> ${_contrib.nbVotes}</span> votes </strong>
                    </div>
                </div>
            </div>`
}

//Get all contributions async function
const getAllContributions = async function (_questId) {
    _questId = parseInt(_questId)
    if (questId != parseInt(_questId)) {
        await setQuestId(parseInt(_questId))
        quest = quests[parseInt(questId)]
    }
    notificationOff('Loading all current contributions')
    contributions = []
    nbContribs = quest.nbContributions //await contract.methods.getQuestNbContribs[questId].call()
    for (let _contribQuestId = 0 ; _contribQuestId < nbContribs ; _contribQuestId++) {
        try {
            let _contribId =  await contract.methods.getContribId(_questId, _contribQuestId).call()
            let _contribRep = await contract.methods.readContribution(_contribId).call()
            let _pseudo =     await getPseudo(_contribRep[1])
            let _contrib = {
                id:             _contribId,
                owner:          _contribRep[1],
                pseudo:         _pseudo,
                questId:        _questId,
                title:          _contribRep[2],
                content:        _contribRep[3],
                nbVotes:        _contribRep[4],
            }
            console.log(_contrib)
            contributions.push(_contrib)
        } catch (error) {
            notification(`⚠️ ${error}.`)
        }
    }
    console.log(contributions)
}
        //Rending all contributions from QuestId
const renderContributionsList = async function (_questId) {
    try {
        await getAllContributions(_questId)
        if (nbContribs == 0) {
            notification('No contribution found')
            return
        }
        document.getElementById('celoquest').innerHTML = ""

        let newHead = document.createElement("div")
        newHead.className = "col-md-8 questHeader"
        newHead.innerHTML = await questHeaderTemplate(_questId)
        newHead.querySelector("#questListBtn").addEventListener('click', async (e) => {
            try {
                notification("Loading Quests page")
                document.querySelector('#celoquest').innerHTML = ""
                await renderQuestsList()
                notificationOff()
            } catch (error) {
            notification(`⚠️ ${error}.`)        }
        })

        document.getElementById('celoquest').appendChild(newHead)
        contributions.forEach(_contrib => {
            try {
                const newDiv = document.createElement("div")
                newDiv.className = "col-md-4 contribBlock"
                newDiv.innerHTML = contribTemplate(_contrib)
                document.getElementById('celoquest').appendChild(newDiv)
                notificationOff()
            } catch (error) {
                notification(`⚠️ ${error}.`)
            }
        })
    } catch (error) {
        notification(`⚠️ ${error}.`)
    }
}

//*******************************************************************************************************/
const loadQuest = async function (_questId) {
    try {
        let _questOwnerPseudo = await contract.methods.getQuestOwnerPseudo(_questId).call()
        const rep = await contract.methods.readQuest(_questId).call()
        let _quest = {
            id: _questId,
            owner: rep[0],
            pseudo: _questOwnerPseudo,
            title: rep[1],
            content: rep[2],
            nbContribs: rep[5],
            contribs: [],
            isActive: rep[6],
        }
        contributions = []
        for (let i = 0; i < _quest.nbContribs; i++) {
            try {
                notification("Loading Contrib " + i + " /" + _quest.nbContribs)
                const _contribId = await contract.methods.getContribId(_questId, i).call()
                const contribRep = await contract.methods.readContribution(_contribId).call()
                let _contribOwner = contribRep[1]
                let _contribPseudo = getPseudo(_contribOwner)
                let _contrib = {
                    id: _contribId,
                    owner: _contribOwner,
                    pseudo: _contribPseudo,
                    title: contribRep[2],
                    content: contribRep[3],
                    nbVotes: contribRep[4],
                }
                contributions.push(_contrib)
            } catch (error) {
                notification(`⚠️ ${error}.`)
            }
        }
        _quest.contribs = contributions
        quest = _quest
        notificationOff()
    } catch (error) {
        notification(`⚠️ ${error}.`)
    }
}

//*************************************************************************************************************/
    //Store Contribution
const storeContribution = async function (_newContrib) {
    try {
        notification("Creating new Contribution")
        await contract.methods.createContribution(questId, _newContrib.title, _newContrib.content)
            .send({ from: kit.defaultAccount})
        notification("New Contribution stored on chain")
        await getAllContributions(questId)
    } catch (error) {
        notification(`⚠️ ${error}.`)
    }
}

async function renderQuestsList() {
    document.getElementById("celoquest").innerHTML = ""
    for (const _quest of quests) {
        const newDiv = document.createElement("div")
        newDiv.className = "col-md-4"
        newDiv.innerHTML = await questTemplate(_quest)
        document.getElementById('celoquest').appendChild(newDiv)
    }
    let _seeContribList = document.querySelector('#celoquest').querySelectorAll("#seeContribBtn")
    for (const _contribBtn of _seeContribList) {
        let _questId = parseInt(_contribBtn.querySelector('#questId').textContent)
        _contribBtn.addEventListener('click', async (e) => {
            console.log("xl")
            await renderContributionsList(parseInt(_questId))
        })
    }
}

//***********************************************************************************************

        //Notifications management
function notification(_text) {
    document.querySelector(".alert").style.display = "block"
    document.querySelector("#notification").textContent = _text
}

function notificationOff() {
    document.querySelector(".alert").style.display = "None"
}

//********************************************************************************************

        //Event listeners
window.addEventListener('load', async () => {
    notification("⌛ Loading...")
    await connectCeloWallet()
    await getBalance()
    await getUser()
    await getAllQuests()

    const listContribBtns = document.querySelector('#celoquest').querySelectorAll('#seeContribBtn')
    listContribBtns.forEach(_btn => {
        _btn.addEventListener('click', async (e) => {
            try {
                let _questId = parseInt(_btn.querySelector('#questId').textContent)
                if (questId != _questId) {
                    if (parseInt(_questId) < parseInt(nbQuests)) {
                        setQuestId(_questId)
                    }
                }
                notification('Loading Contribs')
                await getAllContributions(_questId)
                notificationOff()
            } catch (error) {
                notification(`⚠️ ${error}.`)
            }
        })
    })
    const listNewContribBtns = document.querySelector('#celoquest').querySelectorAll('newContribBtn')
    listNewContribBtns.forEach(_newContribBtn => {
        _newContribBtn.addEventListener('click', async (e) => {
            try {
                let _questId = parseInt(_newContribBtn.querySelector('#questId').textContent)
                if (questId != _questId) {
                    if (parseInt(_questId) < nbQuests) {
                        setQuestIdOnContribModal(_questId)
                    }
                }
            } catch (error) {
                notification(`⚠️ ${error}.`)
            }
        })
    })
    notificationOff()
});

        //New Quest Creation Event
document.querySelector("#newQuestBtn").addEventListener("click", async(e) => {
        try  { const _newQuest = {
            id:             nbQuests,
            owner:          kit.defaultAccount,
            title:          document.getElementById('newQuestTitle').value,
            content:        document.getElementById('newQuestContent').value,
            cUsdReward:     document.getElementById('newcUSDReward').value,
            cqtReward:      document.getElementById('newCQTReward').value
            }
            await storeQuest(_newQuest)
            notification("Quest recorded on Chain !")
            await getAllQuests()
            await renderQuestsList()
            notificationOff()
        } catch (error) {
            notification(`⚠️ ${error}.`)
        }
})


        //New Contrib Event
document.querySelector("#newContribBtn").addEventListener("click", async (e) => {
    try {
        let _newContribd = await contract.methods.getNbContributions().call()
        await setQuestIdOnContribModal(
            parseInt(document.querySelector("#newContribModal").querySelector('#questId')
                .textContent))
        console.log(questId)
        const _newContrib = {
            id:             _newContribd,
            owner:          kit.defaultAccount,
            questId:        questId,
            title:          document.getElementById('newContributionTitle').value,
            content:        document.getElementById('newContributionContent').value,
            nbVotes:        0,
        }
        await storeContribution(_newContrib)
    } catch (error) {
        notification(`⚠️ ${error}.`)
    }
})


//Set Pseudo : when user click on pseudo on user block
document
    .querySelector("#newPseudoBtn").addEventListener("click", async (e) => {
            const _newPseudo = document.getElementById("newPseudo").value
            try {
                const result = await contract.methods
                    .setPseudo(_newPseudo)
                    .send({from: kit.defaultAccount})
                    user = _newPseudo;
                    notification(`🎉You succesfully set pseudo "${user}" for address ${kit.defaultAccount}.`)
                    await getUser()
                    await getBalance()
                    await renderQuestsList()
            } catch (error) {
                notification(`⚠️ ${error}.`)
            }
})