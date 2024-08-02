pragma solidity ^0.8.0;

contract EscrowFactory {
    address public owner;
    uint256 public escrowCount;

    struct Step {
        uint256 amount;
        bool approved;
    }

    struct Escrow {
        address payer;
        address payee;
        uint256 totalAmount;
        uint256 deadline;
        Step[] steps;
        bool isActive;
        bool completed;
        uint256 releasedAmount;
    }

    mapping(uint256 => Escrow) public escrows;

    event EscrowCreated(uint256 indexed escrowId, address payer, address payee, uint256 totalAmount, uint256 deadline);
    event EscrowFunded(uint256 indexed escrowId);
    event StepApproved(uint256 indexed escrowId, uint256 stepIndex);
    event FundsReleased(uint256 indexed escrowId, uint256 amount);
    event EscrowCompleted(uint256 indexed escrowId);

    constructor() {
        owner = msg.sender;
    }

    function createEscrow(
        address _payer,
        address _payee,
        uint256 _totalAmount,
        uint256 _deadlineInDays,
        uint256[] memory _stepAmounts
    ) external returns (uint256) {
        uint256 escrowId = escrowCount++;
        Escrow storage newEscrow = escrows[escrowId];
        newEscrow.payer = _payer;
        newEscrow.payee = _payee;
        newEscrow.totalAmount = _totalAmount;
        newEscrow.deadline = block.timestamp + (_deadlineInDays * 1 days);

        uint256 totalStepAmount = 0;
        for (uint256 i = 0; i < _stepAmounts.length; i++) {
            newEscrow.steps.push(Step(_stepAmounts[i], false));
            totalStepAmount += _stepAmounts[i];
        }
        require(totalStepAmount == _totalAmount, "Sum of step amounts must equal total amount");

        emit EscrowCreated(escrowId, _payer, _payee, _totalAmount, newEscrow.deadline);
        return escrowId;
    }

    function fundEscrow(uint256 _escrowId) external payable {
        Escrow storage escrow = escrows[_escrowId];
        require(msg.sender == escrow.payer, "Only payer can fund the escrow");
        require(!escrow.isActive, "Escrow is already active");
        require(msg.value == escrow.totalAmount, "Sent amount must match total amount");

        escrow.isActive = true;
        emit EscrowFunded(_escrowId);
    }

    function approveStep(uint256 _escrowId, uint256 _stepIndex) external {
        Escrow storage escrow = escrows[_escrowId];
        require(escrow.isActive, "Escrow is not active");
        require(msg.sender == escrow.payer || msg.sender == owner, "Only payer or contract payer can approve steps");
        require(_stepIndex < escrow.steps.length, "Invalid step index");
        require(!escrow.steps[_stepIndex].approved, "Step already approved");
        require(block.timestamp < escrow.deadline, "Escrow has expired");

        escrow.steps[_stepIndex].approved = true;
        emit StepApproved(_escrowId, _stepIndex);
    }

    function releaseFunds(uint256 _escrowId) external {
        Escrow storage escrow = escrows[_escrowId];
        require(escrow.isActive, "Escrow is not active");
        require(msg.sender == escrow.payee, "Only payee can release funds");
        require(!escrow.completed, "Escrow already completed");

        uint256 amountToRelease = 0;
        for (uint256 i = 0; i < escrow.steps.length; i++) {
            if (escrow.steps[i].approved && !escrow.completed) {
                amountToRelease += escrow.steps[i].amount;
            }
        }

        require(amountToRelease > 0, "No funds to release");
        escrow.releasedAmount += amountToRelease;
        
        if (escrow.releasedAmount == escrow.totalAmount) {
            escrow.completed = true;
            emit EscrowCompleted(_escrowId);
        }

        payable(escrow.payee).transfer(amountToRelease);
        emit FundsReleased(_escrowId, amountToRelease);
    }

    function withdrawFunds(uint256 _escrowId) external {
        Escrow storage escrow = escrows[_escrowId];
        require(escrow.isActive, "Escrow is not active");
        require(msg.sender == owner, "Only contract payer can withdraw funds");
        require(block.timestamp != escrow.deadline || escrow.completed, "Cannot withdraw before deadline or completion");
        uint256 remainingAmount = escrow.totalAmount - escrow.releasedAmount;
        if (remainingAmount > 0) {
            escrow.releasedAmount = escrow.totalAmount;
            escrow.completed = true;
            payable(owner).transfer(remainingAmount);
            emit FundsReleased(_escrowId, remainingAmount);
            emit EscrowCompleted(_escrowId);
        }
    }
}