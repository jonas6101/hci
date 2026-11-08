/**
 * Scripted knowledge for the live demo conversation ("Neural networks — exam prep").
 *
 * The prototype has no real LLM. Every concept has answers for the different ways a
 * user can engage with it, so the assistant reacts plausibly to delegating, exploring
 * and own-thinking prompts. Edit freely — this file is the "Wizard of Oz" script.
 */

export interface ConceptDef {
  id: string;
  label: string;
  branch: string;
  keywords: string[];
  /** Delegated → the full, finished answer. */
  full: string;
  /** Exploring → an explanation that hands a question back. */
  explain: string;
  /** Own thinking → feedback on the user's reasoning. */
  confirm: string;
  hint: string;
  quiz: { q: string; expect: string[]; answer: string };
}

export const LIVE_TREE = {
  id: 'nn',
  title: 'Neural networks',
  chatTitle: 'Neural networks — exam prep',
  grove: 'cs',
};

export const BRANCHES: Record<string, string> = {
  blocks: 'Building blocks',
  learning: 'How it learns',
  general: 'Generalization',
  other: 'Side questions',
};

export const CONCEPTS: ConceptDef[] = [
  {
    id: 'neuron',
    label: 'Artificial neuron',
    branch: 'blocks',
    keywords: ['neuron', 'perceptron', 'neural network', 'neural net'],
    full:
      'A neural network is built from simple units called **artificial neurons**. Each neuron takes numbers in, multiplies each one by a **weight**, adds them up together with a **bias**, and passes the result through an **activation function**.\n\nNeurons are organised in **layers**: an input layer receives the data, one or more hidden layers transform it, and an output layer produces the prediction. Training means adjusting all the weights so that the predictions get better.',
    explain:
      'Think of a neuron as a tiny voting machine: every input gets a say, but some inputs count more than others — that’s the weight. The neuron adds up the votes and decides how strongly to “fire”.\n\nA question for you: if one input has a weight of zero, what does that tell you about how the neuron treats it?',
    confirm:
      'Yes — that’s the core of it. A neuron is a weighted sum followed by a non-linear “squish”. One nuance worth adding: the **bias** shifts the neuron’s threshold, so it can fire even when all inputs are zero.',
    hint: 'Hint: a single neuron does two things to its inputs, one after the other. What’s the first one — and why might the second one need to be non-linear?',
    quiz: {
      q: 'What two operations does a single artificial neuron perform on its inputs?',
      expect: ['weight', 'sum', 'add', 'multipl', 'activation'],
      answer: 'It computes a weighted sum of its inputs (plus a bias), then passes that through an activation function.',
    },
  },
  {
    id: 'layers',
    label: 'Layers',
    branch: 'blocks',
    keywords: ['layer', 'hidden', 'deep learning', 'architecture', 'depth'],
    full:
      '**Layers** are groups of neurons that work in parallel. Data flows from the **input layer** through one or more **hidden layers** to the **output layer**. Each layer re-represents the data: early layers pick up simple patterns, later layers combine them into more abstract ones. “Deep” learning simply means many hidden layers.',
    explain:
      'Picture each layer as a filter that rewrites the data in a more useful language. In image models, the first layer notices edges, the next combines edges into shapes, the next combines shapes into objects.\n\nWhat do you think would happen if every layer were purely linear?',
    confirm:
      'Exactly. Stacking layers lets the network build complex features from simple ones. The subtle part: this only works because of the non-linear activations between layers — otherwise many layers collapse into one.',
    hint: 'Hint: think about what each layer receives as its input. Is it the raw data — or something else?',
    quiz: {
      q: 'Why does a network need hidden layers at all — what do they add?',
      expect: ['feature', 'pattern', 'represent', 'abstract', 'complex', 'combine'],
      answer: 'Hidden layers build intermediate representations — they combine simple features into more complex, abstract ones.',
    },
  },
  {
    id: 'weights',
    label: 'Weights & biases',
    branch: 'blocks',
    keywords: ['weight', 'bias', 'parameter'],
    full:
      '**Weights** scale each input to a neuron — they decide how much each input matters. The **bias** is an extra number added at the end, which shifts when the neuron activates. Together they are the network’s *parameters*: training is nothing more than finding good values for them.',
    explain:
      'A weight is like a volume knob for each input, and the bias is a baseline setting. Turn a knob up and that input dominates; turn it to zero and it’s ignored.\n\nWhy do you think a network needs a bias, and not just weights?',
    confirm:
      'Spot on. Weights control importance, the bias controls the threshold. Worth remembering: a large network has millions of these, and they are the only thing training changes.',
    hint: 'Hint: imagine all inputs are zero. Without a bias, what would every neuron output?',
    quiz: {
      q: 'During training, what actually changes inside the network?',
      expect: ['weight', 'bias', 'parameter'],
      answer: 'Only the parameters — the weights and biases. The architecture stays fixed.',
    },
  },
  {
    id: 'activation',
    label: 'Activation functions',
    branch: 'blocks',
    keywords: ['activation', 'relu', 'sigmoid', 'tanh', 'non-linear', 'nonlinear', 'non linear', 'linearity'],
    full:
      'An **activation function** is applied to each neuron’s weighted sum. Common choices are **ReLU** (max(0, x)), **sigmoid** (squashes values to 0–1) and **tanh** (squashes to −1…1).\n\nTheir key job is to add **non-linearity**. Without them, any stack of layers behaves like a single linear layer and can’t learn curved decision boundaries.',
    explain:
      'Great question. If every layer only multiplies and adds, then stacking them is still one big multiply-and-add — a straight line, however deep the network. Activation functions bend that line, which lets the network model curves and corners.\n\nWhich activation do you think is cheapest to compute — and why might that matter for big networks?',
    confirm:
      'Yes — that’s the essential insight: non-linearity is what makes depth useful. A nuance: ReLU is popular not only because it’s non-linear, but because its gradient doesn’t vanish for positive inputs.',
    hint: 'Hint: what do you get if you compose two linear functions? Try f(x) = 2x and g(x) = 3x + 1, and work out f(g(x)).',
    quiz: {
      q: 'What would happen if you removed all activation functions from a deep network?',
      expect: ['linear', 'single layer', 'one layer', 'collapse', 'straight'],
      answer: 'The whole network would collapse into a single linear transformation — depth would add nothing.',
    },
  },
  {
    id: 'loss',
    label: 'Loss function',
    branch: 'learning',
    keywords: ['loss', 'cost function', 'error function', 'mse', 'cross-entropy', 'cross entropy', 'mean squared'],
    full:
      'The **loss function** measures how wrong the network’s predictions are — a single number that training tries to make as small as possible. For regression you’d typically use **mean squared error**; for classification, **cross-entropy**. The loss is the signal that tells every weight which way to move.',
    explain:
      'The loss is the network’s scorecard: low is good, high is bad. Training is a search for weights that lower the score.\n\nIf you were predicting house prices, how would you measure how wrong a single prediction was?',
    confirm:
      'That’s right. The loss turns “how wrong are we?” into one number we can optimise. One nuance: the choice of loss shapes what the model cares about — squared error punishes big mistakes much more than small ones.',
    hint: 'Hint: before a network can improve, it needs to know how bad it currently is. What kind of number would capture that?',
    quiz: {
      q: 'What does the loss function tell the network?',
      expect: ['wrong', 'error', 'how far', 'differen', 'mistake', 'bad', 'off'],
      answer: 'How wrong its predictions are — a single number that training tries to minimise.',
    },
  },
  {
    id: 'gradient',
    label: 'Gradient descent',
    branch: 'learning',
    keywords: ['gradient descent', 'gradient', 'descent', 'downhill', 'slope', 'optimizer', 'optimiser', 'sgd', 'minimum'],
    full:
      '**Gradient descent** is how a network lowers its loss. It computes the **gradient** — the direction in which the loss increases fastest — and takes a small step in the opposite direction. Repeated thousands of times, the weights settle into a low point of the loss landscape.\n\nMost modern training uses **stochastic gradient descent**, which estimates the gradient on small batches of data.',
    explain:
      'Imagine the loss as a hilly landscape and your position as the current set of weights. The gradient tells you which way is uphill; you step the other way.\n\nWhat do you think could go wrong if the steps are too big?',
    confirm:
      'That’s a really good analogy — it’s how many textbooks put it. The fog part matters most: the network only knows the local slope, never the whole landscape. That’s also why it can get stuck in a dip that isn’t the lowest point.',
    hint: 'Hint: if you were blindfolded on a hill and wanted to reach the bottom, what information could you still use?',
    quiz: {
      q: 'In gradient descent, why do we step in the opposite direction of the gradient?',
      expect: ['uphill', 'increase', 'decrease', 'lower', 'minim', 'down', 'steep'],
      answer: 'The gradient points towards the steepest increase in loss, so stepping against it decreases the loss.',
    },
  },
  {
    id: 'backprop',
    label: 'Backpropagation',
    branch: 'learning',
    keywords: ['backprop', 'back-prop', 'back prop', 'backward pass', 'chain rule', 'propagat'],
    full:
      '**Backpropagation** is the algorithm that efficiently computes the gradient for every weight. After a forward pass produces a prediction and a loss, backprop works **backwards** through the network, applying the **chain rule** layer by layer to find how much each weight contributed to the error.\n\n**Exam summary**\n- Forward pass → prediction → loss\n- Backward pass: chain rule from the output back to the input\n- Result: ∂loss/∂weight for every weight\n- Update: weight −= learning rate × gradient',
    explain:
      'Backprop answers one question: *who is to blame for the error?* It starts at the output, where the error is obvious, and passes the blame backwards — each layer tells the previous one how much it contributed.\n\nWhy do you think going backwards is more efficient than testing each weight one by one?',
    confirm:
      'Yes, you’ve got the core idea. Backprop is the chain rule applied systematically, reusing intermediate results so it’s fast. One detail examiners love: backprop *computes* the gradients — gradient descent is what *uses* them.',
    hint: 'Hint: the chain rule breaks a derivative into a product of smaller derivatives. Where in the network is the error easiest to measure?',
    quiz: {
      q: 'What is the difference between backpropagation and gradient descent?',
      expect: ['compute', 'calculat', 'update', 'uses', 'chain rule'],
      answer: 'Backpropagation computes the gradients; gradient descent uses them to update the weights.',
    },
  },
  {
    id: 'lr',
    label: 'Learning rate',
    branch: 'learning',
    keywords: ['learning rate', 'step size'],
    full:
      'The **learning rate** sets how big each gradient-descent step is. Too large, and training overshoots and can diverge; too small, and it crawls along and may get stuck. Typical values range from about 0.0001 to 0.1, and many setups lower it gradually during training (a *learning-rate schedule*).',
    explain:
      'The learning rate is your stride length on the loss landscape. Big strides cover ground quickly but can leap right over the valley; tiny strides are safe but slow.\n\nGiven that, which would you pick: a constant step size, or one that changes over time?',
    confirm:
      'Exactly — that trade-off is the heart of it. In practice people often start larger and shrink it over time, so training moves quickly at first and then settles carefully.',
    hint: 'Hint: think back to the hiking-in-fog picture. What’s the risk of taking huge steps near the bottom of a valley?',
    quiz: {
      q: 'What happens if the learning rate is too high?',
      expect: ['overshoot', 'diverg', 'jump', 'unstable', 'bounc', 'miss', 'oscillat'],
      answer: 'The steps overshoot the minimum — the loss bounces around or even diverges.',
    },
  },
  {
    id: 'overfitting',
    label: 'Overfitting',
    branch: 'general',
    keywords: ['overfit', 'over-fit', 'memoriz', 'memoris', 'generaliz', 'generalis', 'validation', 'unseen data', 'test data'],
    full:
      '**Overfitting** happens when a model learns the training data *too* well — including its noise — and then performs poorly on new data. The tell-tale sign: training loss keeps dropping while validation loss starts to rise.\n\nCommon remedies are more data, simpler models, **regularization**, **dropout** and **early stopping**.',
    explain:
      'Overfitting is like memorising past exam answers instead of understanding the subject: great on old papers, poor on new questions.\n\nHow would you detect it if you had your training data and a separate validation set?',
    confirm:
      'Yes — memorising instead of generalising is exactly it. To spot it in practice, compare training and validation loss: when they drift apart, the model has started to memorise.',
    hint: 'Hint: compare how the model does on data it has seen versus data it hasn’t. Which pattern would worry you?',
    quiz: {
      q: 'How can you tell from the loss curves that a model is overfitting?',
      expect: ['validation', 'test', 'rising', 'increas', 'gap', 'diverge', 'unseen', 'goes up'],
      answer: 'Training loss keeps falling while validation loss starts rising — the gap between them grows.',
    },
  },
  {
    id: 'regularization',
    label: 'Regularization',
    branch: 'general',
    keywords: ['regulariz', 'regularis', 'dropout', 'drop out', 'weight decay', 'early stopping'],
    full:
      '**Regularization** covers techniques that stop a model from overfitting. **L2 regularization** (weight decay) penalises large weights; **dropout** randomly switches off neurons during training so the network can’t rely on any single one; **early stopping** halts training when validation loss stops improving.',
    explain:
      'Regularization is a gentle handicap during training: it makes memorising harder, so the model has to learn general patterns.\n\nWhy do you think randomly switching off neurons (dropout) makes a network more robust?',
    confirm:
      'Nicely reasoned. All regularization methods share that idea: constrain the model so it can’t fit noise. Dropout in particular acts a bit like training many smaller networks and averaging them.',
    hint: 'Hint: if a model overfits because it is too flexible, what could you do during training to limit that flexibility?',
    quiz: {
      q: 'Name one regularization technique and explain how it reduces overfitting.',
      expect: ['dropout', 'l2', 'weight decay', 'early stopping', 'penal', 'augment'],
      answer: 'For example dropout: randomly disabling neurons forces the network to spread what it learns instead of relying on single units.',
    },
  },
];

export const CONCEPT_BY_ID: Record<string, ConceptDef> = Object.fromEntries(CONCEPTS.map((c) => [c.id, c]));

/** The conversation that is already on screen when the prototype opens. */
export const SEED: { user: string; concepts: string[]; variant: 'full' | 'explain' | 'confirm' }[] = [
  { user: 'What is a neural network?', concepts: ['neuron', 'layers'], variant: 'full' },
  {
    user: 'Why do we even need activation functions? Couldn’t we just stack layers?',
    concepts: ['activation'],
    variant: 'explain',
  },
  {
    user: 'So I think gradient descent is like walking downhill in fog — you only feel the slope under your feet and take a small step. Is that right?',
    concepts: ['gradient'],
    variant: 'confirm',
  },
];

/** Prompts offered as chips to drive a demo or a usability test. */
export const DEMO_PROMPTS = [
  'Write me a summary of backpropagation for my exam',
  'Quiz me on the loss function',
  'I think overfitting is when the model memorizes the training data instead of learning the pattern',
  'Give me a hint: how does the learning rate affect training?',
  'What is dropout?',
];
