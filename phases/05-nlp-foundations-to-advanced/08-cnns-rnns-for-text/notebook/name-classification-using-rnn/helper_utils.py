import string
import unicodedata
from io import open
import glob
import os
import time
import random

import torch
from torch.utils.data import Dataset

# We can use "_" to represent an out-of-vocabulary character, that is, any character we are not handling in our model
allowed_characters = string.ascii_letters + " .,;'" + "_"
n_letters = len(allowed_characters)



# Turn a Unicode string to plain ASCII, thanks to https://stackoverflow.com/a/518232/2809427
def unicodeToAscii(s):
    """
    convert Unicode to plain ASCII to limit the RNN input layers. 
    This is accomplished by converting Unicode strings to ASCII and 
    allowing only a small set of allowed characters.
    """
    return ''.join(
        c for c in unicodedata.normalize('NFD', s)
        if unicodedata.category(c) != 'Mn'
        and c in allowed_characters
    )

# Find letter index from all_letters, e.g. "a" = 0
def letterToIndex(letter):
    # return our out-of-vocabulary character if we encounter a letter unknown to our model
    if letter not in allowed_characters:
        return allowed_characters.find("_")
    else:
        return allowed_characters.find(letter)


# Turn a line into a <line_length x 1 x n_letters>,
# or an array of one-hot letter vectors
def lineToTensor(line):
    tensor = torch.zeros(len(line), 1, n_letters)
    for li, letter in enumerate(line):
        tensor[li][0][letterToIndex(letter)] = 1
    return tensor

def letterToTensor(letter):
    tensor = torch.zeros(1, n_letters)
    tensor[0][letterToIndex(letter)] = 1
    return tensor

def load_data():
    # Build the category_lines dictionary, a list of lines per category
    category_lines = {}
    all_categories = []
    
    def findFiles(path): 
        return glob.glob(path)

    # Read a file and split into lines
    def readLines(filename):
        lines = open(filename, encoding='utf-8').read().strip().split('\n')
        return [unicodeToAscii(line) for line in lines]

    
    for filename in findFiles('data/names/*.txt'):
        category = os.path.splitext(os.path.basename(filename))[0]
        all_categories.append(category)
        
        lines = readLines(filename)
        category_lines[category] = lines

        n_categories = len(all_categories)

        if n_categories == 0:
            raise RuntimeError('Data not found. Make sure that you downloaded data '
                'from https://download.pytorch.org/tutorial/data.zip and extract it to '
                'the current directory.')
    return category_lines, all_categories


def random_training_example(category_lines, all_categories):
    def randomChoice(a):
        random_idx = random.randint(0, len(a) - 1)
        return a[random_idx]
    
    category = randomChoice(all_categories)
    line = randomChoice(category_lines[category])
    category_tensor = torch.tensor([all_categories.index(category)], dtype=torch.long)
    line_tensor = lineToTensor(line)
    return category, line, category_tensor, line_tensor