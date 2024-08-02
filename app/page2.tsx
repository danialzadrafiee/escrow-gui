"use client"
import React, { useState, useEffect } from "react"
import Web3 from "web3"
import { ThemeProvider, createTheme } from "@mui/material/styles"
import {
  CssBaseline,
  Container,
  Typography,
  Box,
  TextField,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Snackbar,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material"
import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import { abi } from "./abi"

const contractABI = abi
const contractAddress = "0x8AA7b369C40d77299D617A72d4a524Ea876Dad86"

const theme = createTheme()

interface EscrowStep {
  amount: string
  approved: boolean
}

interface Escrow {
  id: number
  payer: string
  payee: string
  totalAmount: string
  deadline: number
  isActive: boolean
  completed: boolean
  releasedAmount: string
}
function App() {
  const [web3, setWeb3] = useState<Web3 | null>(null)
  const [contract, setContract] = useState<any>(null)
  const [account, setAccount] = useState<string>("")
  const [escrows, setEscrows] = useState<Escrow[]>([])
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [selectedEscrow, setSelectedEscrow] = useState<Escrow | null>(null)
  const [newEscrow, setNewEscrow] = useState({
    payer: "",
    payee: "",
    totalAmount: "",
    deadlineInDays: "",
    stepAmounts: "",
  })
  const [fundEscrowId, setFundEscrowId] = useState("")
  const [approveStepData, setApproveStepData] = useState({ escrowId: "", stepIndex: "" })
  const [releaseFundsId, setReleaseFundsId] = useState("")
  const [withdrawFundsId, setWithdrawFundsId] = useState("")

  useEffect(() => {
    const initWeb3 = async () => {
      if (window.ethereum) {
        const web3Instance = new Web3(window.ethereum)
        try {
          await window.ethereum.request({ method: "eth_requestAccounts" })
          const accounts = await web3Instance.eth.getAccounts()
          setAccount(accounts[0])
          setWeb3(web3Instance)
          const contractInstance = new web3Instance.eth.Contract(contractABI, contractAddress)
          setContract(contractInstance)
        } catch (error) {
          console.error("User denied account access", error)
          setNotification({ type: "error", message: "Failed to connect to MetaMask. Please try again." })
        }
      } else {
        console.log("Non-Ethereum browser detected. You should consider trying MetaMask!")
        setNotification({ type: "error", message: "Non-Ethereum browser detected. Please install MetaMask." })
      }
    }

    initWeb3()
  }, [])

  useEffect(() => {
    if (contract) {
      fetchEscrows()
    }
  }, [contract])
  const fetchEscrowSteps = async (escrowId: number) => {
    if (!contract || !web3) return
    try {
      const result = await contract.methods.getEscrowSteps(escrowId).call()
      const steps: EscrowStep[] = result[0].map((amount: string, index: number) => ({
        amount: web3.utils.fromWei(amount, "ether"),
        approved: result[1][index],
      }))
      return steps
    } catch (error) {
      console.error(`Error fetching steps for escrow ${escrowId}:`, error)
      return []
    }
  }
  const fetchEscrows = async () => {
    if (!contract || !web3) return
    setLoading(true)
    try {
      const escrowCount = await contract.methods.escrowCount().call()
      const fetchedEscrows = []

      for (let i = 0; i < Number(escrowCount); i++) {
        try {
          const escrow = await contract.methods.escrows(i).call()
          const steps = await fetchEscrowSteps(i)
          fetchedEscrows.push({
            id: i,
            payer: escrow.payer,
            payee: escrow.payee,
            totalAmount: escrow.totalAmount.toString(),
            deadline: Number(escrow.deadline),
            isActive: escrow.isActive,
            completed: escrow.completed,
            releasedAmount: escrow.releasedAmount.toString(),
            steps: steps,
          })
        } catch (error) {
          console.error(`Error fetching escrow ${i}:`, error)
        }
      }

      setEscrows(fetchedEscrows)
    } catch (error) {
      console.error("Error fetching escrows:", error)
      setNotification({ type: "error", message: "Failed to fetch escrows. Please try again." })
    } finally {
      setLoading(false)
    }
  }

  const handleEscrowClick = (escrow: Escrow) => {
    setSelectedEscrow(escrow)
  }
  const fetchEscrows = async () => {
    if (!contract || !web3) return
    setLoading(true)
    try {
      const escrowCount = await contract.methods.escrowCount().call()
      const fetchedEscrows = []

      for (let i = 0; i < Number(escrowCount); i++) {
        try {
          const escrow = await contract.methods.escrows(i).call()
          fetchedEscrows.push({
            id: i,
            payer: escrow.payer,
            payee: escrow.payee,
            totalAmount: escrow.totalAmount.toString(),
            deadline: Number(escrow.deadline),
            isActive: escrow.isActive,
            completed: escrow.completed,
            releasedAmount: escrow.releasedAmount.toString(),
          })
        } catch (error) {
          console.error(`Error fetching escrow ${i}:`, error)
        }
      }

      setEscrows(fetchedEscrows)
    } catch (error) {
      console.error("Error fetching escrows:", error)
      setNotification({ type: "error", message: "Failed to fetch escrows. Please try again." })
    } finally {
      setLoading(false)
    }
  }
  const handleCreateEscrow = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contract || !account || !web3) return

    setLoading(true)
    try {
      const { payer, payee, totalAmount, deadlineInDays, stepAmounts } = newEscrow
      const stepAmountsArray = stepAmounts.split(",").map((amount) => web3.utils.toWei(amount.trim(), "ether"))

      const gasEstimate = await contract.methods.createEscrow(payer, payee, web3.utils.toWei(totalAmount, "ether"), deadlineInDays, stepAmountsArray).estimateGas({ from: account })

      await contract.methods.createEscrow(payer, payee, web3.utils.toWei(totalAmount, "ether"), deadlineInDays, stepAmountsArray).send({ from: account, gas: gasEstimate })

      setNotification({ type: "success", message: "Escrow created successfully" })
      fetchEscrows()
    } catch (error) {
      console.error("Error creating escrow:", error)
      setNotification({ type: "error", message: "Error creating escrow. Please check your inputs and try again." })
    } finally {
      setLoading(false)
    }
  }

  const handleFundEscrow = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contract || !account || !web3) return

    setLoading(true)
    try {
      const escrow = escrows.find((e) => e.id === parseInt(fundEscrowId))
      if (!escrow) throw new Error("Escrow not found")

      const gasEstimate = await contract.methods.fundEscrow(fundEscrowId).estimateGas({
        from: account,
        value: escrow.totalAmount,
      })

      await contract.methods.fundEscrow(fundEscrowId).send({
        from: account,
        value: escrow.totalAmount,
        gas: gasEstimate,
      })

      setNotification({ type: "success", message: "Escrow funded successfully" })
      fetchEscrows()
    } catch (error) {
      console.error("Error funding escrow:", error)
      setNotification({ type: "error", message: "Error funding escrow. Please check your inputs and try again." })
    } finally {
      setLoading(false)
    }
  }

  const handleApproveStep = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contract || !account) return

    setLoading(true)
    try {
      const gasEstimate = await contract.methods.approveStep(approveStepData.escrowId, approveStepData.stepIndex).estimateGas({ from: account })

      await contract.methods.approveStep(approveStepData.escrowId, approveStepData.stepIndex).send({ from: account, gas: gasEstimate })
      setNotification({ type: "success", message: "Step approved successfully" })
      fetchEscrows()
    } catch (error) {
      console.error("Error approving step:", error)
      setNotification({ type: "error", message: "Error approving step. Please check your inputs and try again." })
    } finally {
      setLoading(false)
    }
  }

  const handleReleaseFunds = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contract || !account) return

    setLoading(true)
    try {
      const gasEstimate = await contract.methods.releaseFunds(releaseFundsId).estimateGas({ from: account })

      await contract.methods.releaseFunds(releaseFundsId).send({ from: account, gas: gasEstimate })
      setNotification({ type: "success", message: "Funds released successfully" })
      fetchEscrows()
    } catch (error) {
      console.error("Error releasing funds:", error)
      setNotification({ type: "error", message: "Error releasing funds. Please check your inputs and try again." })
    } finally {
      setLoading(false)
    }
  }

  const handleWithdrawFunds = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contract || !account) return

    setLoading(true)
    try {
      const gasEstimate = await contract.methods.withdrawFunds(withdrawFundsId).estimateGas({ from: account })

      await contract.methods.withdrawFunds(withdrawFundsId).send({ from: account, gas: gasEstimate })
      setNotification({ type: "success", message: "Funds withdrawn successfully" })
      fetchEscrows()
    } catch (error) {
      console.error("Error withdrawing funds:", error)
      setNotification({ type: "error", message: "Error withdrawing funds. Please check your inputs and try again." })
    } finally {
      setLoading(false)
    }
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="lg">
        <Box sx={{ my: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Escrow Factory
          </Typography>
          {web3 && contract ? (
            <>
              <Typography variant="subtitle1" gutterBottom>
                Connected Account: {account}
              </Typography>

              <Box component="form" onSubmit={handleCreateEscrow} sx={{ mt: 3 }}>
                <Typography variant="h6">Create Escrow</Typography>
                <TextField label="Payer Address" value={newEscrow.payer} onChange={(e) => setNewEscrow({ ...newEscrow, payer: e.target.value })} fullWidth margin="normal" />
                <TextField label="Payee Address" value={newEscrow.payee} onChange={(e) => setNewEscrow({ ...newEscrow, payee: e.target.value })} fullWidth margin="normal" />
                <TextField label="Total Amount (ETH)" value={newEscrow.totalAmount} onChange={(e) => setNewEscrow({ ...newEscrow, totalAmount: e.target.value })} fullWidth margin="normal" />
                <TextField label="Deadline (days)" value={newEscrow.deadlineInDays} onChange={(e) => setNewEscrow({ ...newEscrow, deadlineInDays: e.target.value })} fullWidth margin="normal" />
                <TextField label="Step Amounts (comma-separated ETH values)" value={newEscrow.stepAmounts} onChange={(e) => setNewEscrow({ ...newEscrow, stepAmounts: e.target.value })} fullWidth margin="normal" />
                <Button type="submit" variant="contained" color="primary" disabled={loading}>
                  {loading ? <CircularProgress size={24} /> : "Create Escrow"}
                </Button>
              </Box>

              <Box component="form" onSubmit={handleFundEscrow} sx={{ mt: 3 }}>
                <Typography variant="h6">Fund Escrow</Typography>
                <TextField label="Escrow ID" value={fundEscrowId} onChange={(e) => setFundEscrowId(e.target.value)} fullWidth margin="normal" />
                <Button type="submit" variant="contained" color="primary" disabled={loading}>
                  {loading ? <CircularProgress size={24} /> : "Fund Escrow"}
                </Button>
              </Box>

              <Box component="form" onSubmit={handleApproveStep} sx={{ mt: 3 }}>
                <Typography variant="h6">Approve Step</Typography>
                <TextField label="Escrow ID" value={approveStepData.escrowId} onChange={(e) => setApproveStepData({ ...approveStepData, escrowId: e.target.value })} fullWidth margin="normal" />
                <TextField label="Step Index" value={approveStepData.stepIndex} onChange={(e) => setApproveStepData({ ...approveStepData, stepIndex: e.target.value })} fullWidth margin="normal" />
                <Button type="submit" variant="contained" color="primary" disabled={loading}>
                  {loading ? <CircularProgress size={24} /> : "Approve Step"}
                </Button>
              </Box>

              <Box component="form" onSubmit={handleReleaseFunds} sx={{ mt: 3 }}>
                <Typography variant="h6">Release Funds</Typography>
                <TextField label="Escrow ID" value={releaseFundsId} onChange={(e) => setReleaseFundsId(e.target.value)} fullWidth margin="normal" />
                <Button type="submit" variant="contained" color="primary" disabled={loading}>
                  {loading ? <CircularProgress size={24} /> : "Release Funds"}
                </Button>
              </Box>

              <Box component="form" onSubmit={handleWithdrawFunds} sx={{ mt: 3 }}>
                <Typography variant="h6">Withdraw Funds</Typography>
                <TextField label="Escrow ID" value={withdrawFundsId} onChange={(e) => setWithdrawFundsId(e.target.value)} fullWidth margin="normal" />
                <Button type="submit" variant="contained" color="primary" disabled={loading}>
                  {loading ? <CircularProgress size={24} /> : "Withdraw Funds"}
                </Button>
              </Box>

              <TableContainer component={Paper} sx={{ mt: 3 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>ID</TableCell>
                      <TableCell>Payer</TableCell>
                      <TableCell>Payee</TableCell>
                      <TableCell>Total Amount</TableCell>
                      <TableCell>Deadline</TableCell>
                      <TableCell>Active</TableCell>
                      <TableCell>Completed</TableCell>
                      <TableCell>Released Amount</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {escrows.map((escrow) => (
                      <React.Fragment key={escrow.id}>
                        <TableRow>
                          <TableCell>{escrow.id}</TableCell>
                          <TableCell>{escrow.payer}</TableCell>
                          <TableCell>{escrow.payee}</TableCell>
                          <TableCell>{web3!.utils.fromWei(escrow.totalAmount, "ether")} ETH</TableCell>
                          <TableCell>{new Date(escrow.deadline * 1000).toLocaleString()}</TableCell>
                          <TableCell>{escrow.isActive ? "Yes" : "No"}</TableCell>
                          <TableCell>{escrow.completed ? "Yes" : "No"}</TableCell>
                          <TableCell>{web3!.utils.fromWei(escrow.releasedAmount, "ether")} ETH</TableCell>
                          <TableCell>
                            <Button onClick={() => handleEscrowClick(escrow)}>View Steps</Button>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {selectedEscrow && (
                <Accordion sx={{ mt: 2 }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>Escrow Steps for ID: {selectedEscrow.id}</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Step</TableCell>
                          <TableCell>Amount</TableCell>
                          <TableCell>Approved</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedEscrow.steps.map((step, index) => (
                          <TableRow key={index}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell>{step.amount} ETH</TableCell>
                            <TableCell>{step.approved ? "Yes" : "No"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </AccordionDetails>
                </Accordion>
              )}
            </>
          ) : (
            <Typography variant="body1">Loading Web3, accounts, and contract...</Typography>
          )}
        </Box>
      </Container>
      <Snackbar open={!!notification} autoHideDuration={6000} onClose={() => setNotification(null)}>
        <Alert onClose={() => setNotification(null)} severity={notification?.type} sx={{ width: "100%" }}>
          {notification?.message}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  )
}

export default App
